import type {
	ConverterEngine,
	ParsedCard,
	ConversionResult,
	CsvFormat,
	ScryfallResponse,
	CardIdentifier,
	ProgressCallback,
	ScryfallCard,
	ApiHealthResult,
	SetValidationResult
} from './types.js';
import { formatAutoDetector, type FormatDetectionResult } from './formats/index.js';
import { checkScryfallApiHealth, validateSetCode, findSetCodeByName } from './scryfall-utils.js';
import Papa from 'papaparse';

// Rate limiting for Scryfall API (max 10 requests per second)
const RATE_LIMIT_DELAY = 100; // 100ms between requests
const BATCH_SIZE = 75; // Scryfall collection endpoint limit

// Scryfall API functions
async function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Language mapping based on Scryfall documentation
const LANGUAGE_MAPPINGS: Record<string, string[]> = {
	en: ['en', 'english', 'eng'],
	es: ['es', 'sp', 'spanish', 'español', 'espanol'],
	fr: ['fr', 'french', 'français', 'francais'],
	de: ['de', 'german', 'deutsch'],
	it: ['it', 'italian', 'italiano'],
	pt: ['pt', 'portuguese', 'português', 'portugues'],
	ja: ['ja', 'jp', 'japanese', '日本語', 'nihongo'],
	ko: ['ko', 'kr', 'korean', '한국어', 'hangukeo'],
	ru: ['ru', 'russian', 'русский', 'russkiy'],
	zhs: ['zhs', 'cs', 'chinese simplified', 'simplified chinese', '简体中文', 'jianti'],
	zht: ['zht', 'ct', 'chinese traditional', 'traditional chinese', '繁體中文', 'fanti'],
	he: ['he', 'hebrew', 'עברית', 'ivrit'],
	la: ['la', 'latin'],
	grc: ['grc', 'ancient greek', 'greek', 'ελληνικά'],
	ar: ['ar', 'arabic', 'العربية'],
	sa: ['sa', 'sanskrit', 'संस्कृत'],
	ph: ['ph', 'phyrexian'],
	qya: ['qya', 'quenya']
};

// Function to normalize and validate language matches
function validateLanguageMatch(originalLanguage: string, scryfallLanguage: string): boolean {
	if (!originalLanguage || !scryfallLanguage) {
		return true; // If either is missing, don't validate
	}

	const normalizedOriginal = originalLanguage.toLowerCase().trim();
	const normalizedScryfall = scryfallLanguage.toLowerCase().trim();

	// Direct match
	if (normalizedOriginal === normalizedScryfall) {
		return true;
	}

	// Check if both languages map to the same Scryfall language code
	for (const [scryfallCode, aliases] of Object.entries(LANGUAGE_MAPPINGS)) {
		const originalMatches = aliases.some((alias) => alias.toLowerCase() === normalizedOriginal);
		const scryfallMatches =
			scryfallCode === normalizedScryfall ||
			aliases.some((alias) => alias.toLowerCase() === normalizedScryfall);

		if (originalMatches && scryfallMatches) {
			return true;
		}
	}

	return false;
}

// Validation function to check if Scryfall data matches original CSV data
function validateScryfallMatch(
	originalCard: ParsedCard,
	scryfallCard: ScryfallCard
): { isValid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Validate name match
	if (originalCard.name.toLowerCase() !== scryfallCard.name.toLowerCase()) {
		errors.push(`Name mismatch: expected "${originalCard.name}", got "${scryfallCard.name}"`);
	}

	// Validate set code match (if provided in original)
	if (
		originalCard.edition &&
		originalCard.edition.toLowerCase() !== scryfallCard.set.toLowerCase()
	) {
		errors.push(`Set code mismatch: expected "${originalCard.edition}", got "${scryfallCard.set}"`);
	}

	// Validate collector number match (if provided in original)
	if (
		originalCard.collectorNumber &&
		originalCard.collectorNumber !== scryfallCard.collector_number
	) {
		errors.push(
			`Collector number mismatch: expected "${originalCard.collectorNumber}", got "${scryfallCard.collector_number}"`
		);
	}

	// Validate foil/finish availability (if specified in original)
	if (originalCard.foil && originalCard.foil.trim() !== '') {
		const normalizedFinish = originalCard.foil.toLowerCase().trim();
		const availableFinishes = scryfallCard.finishes?.map((f) => f.toLowerCase()) || [];

		// Map common finish names to Scryfall's format
		let expectedFinish: string;
		if (
			normalizedFinish === 'foil' ||
			normalizedFinish === 'yes' ||
			normalizedFinish === 'true' ||
			normalizedFinish === '1'
		) {
			expectedFinish = 'foil';
		} else if (
			normalizedFinish === 'normal' ||
			normalizedFinish === 'nonfoil' ||
			normalizedFinish === 'no' ||
			normalizedFinish === 'false' ||
			normalizedFinish === '0'
		) {
			expectedFinish = 'nonfoil';
		} else if (normalizedFinish === 'etched') {
			expectedFinish = 'etched';
		} else {
			// For any other values, try to match directly
			expectedFinish = normalizedFinish;
		}

		if (!availableFinishes.includes(expectedFinish)) {
			errors.push(
				`Finish not available: "${originalCard.foil}" not available for this card (available: ${scryfallCard.finishes?.join(', ') || 'none'})`
			);
		}
	} // NOTE: Language validation is now handled separately in performLanguageValidationAndSecondaryLookups
	// We don't validate language match here to avoid failing cards that could be corrected via Search API

	return {
		isValid: errors.length === 0,
		errors
	};
}

async function fetchScryfallCollection(identifiers: CardIdentifier[]): Promise<ScryfallResponse> {
	try {
		console.log(`Making Scryfall API request for ${identifiers.length} cards`);

		const response = await fetch('https://api.scryfall.com/cards/collection', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'Omenpath/1.0',
				Accept: 'application/json'
			},
			body: JSON.stringify({
				identifiers: identifiers.slice(0, BATCH_SIZE)
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Scryfall API error: ${response.status} ${response.statusText}`, errorText);
			throw new Error(`Scryfall API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		console.log(
			`Scryfall API response: found ${data.data?.length || 0}, not found ${data.not_found?.length || 0}`
		);

		return data;
	} catch (error) {
		console.error('Network error during Scryfall API request', error);
		throw new Error('Network error communicating with Scryfall API');
	}
}

// CSV export utility function
export function formatAsMoxfieldCSV(results: ConversionResult[]): string {
	const headers = [
		'Count',
		'Name',
		'Edition',
		'Condition',
		'Language',
		'Foil',
		'Tags',
		'Last Modified',
		'Collector Number',
		'Alter',
		'Proxy',
		'Purchase Price'
	];

	const csvLines = [headers.map((h) => `"${h}"`).join(',')];

	// Sort results alphabetically by name
	const sortedResults = [...results].sort((a, b) => {
		const aName = a.moxfieldRow.Name || '';
		const bName = b.moxfieldRow.Name || '';
		return aName.localeCompare(bName);
	});

	sortedResults.forEach((result) => {
		const row = headers.map((header) => {
			const value = result.moxfieldRow[header] || '';
			return `"${value.replace(/"/g, '""')}"`;
		});
		csvLines.push(row.join(','));
	});

	return csvLines.join('\n');
}

export function createConverterEngine(): ConverterEngine {
	return {
		// Get all supported formats from the auto-detector
		getSupportedFormats: () => {
			return formatAutoDetector.getAllFormats();
		},

		// Auto-detect format from CSV headers
		detectFormat: (headers: string[]) => {
			const detection = formatAutoDetector.detectFormat(headers);
			return detection?.format.id || null;
		},

		// Parse file into ParsedCard array
		parseFile: async (file: File, format: string): Promise<ParsedCard[]> => {
			const content = await file.text();
			return parseCSVContent(content, format);
		}, // Convert file to Moxfield format using the new 3-step process
		convertFile: async (
			file: File,
			format: string,
			progressCallback?: (progress: number) => void,
			defaultCondition?: string
		): Promise<ConversionResult[]> => {
			if (progressCallback) progressCallback(0); // Step 0: Parse CSV content
			const content = await file.text();
			const parsedCards = await parseCSVContent(content, format, progressCallback);

			// Note: Set validation and confidence assignment should have happened at UI level
			// If not, assign basic confidence levels as fallback
			for (const card of parsedCards) {
				if (!card.initialConfidence) {
					if (card.scryfallId) {
						card.initialConfidence = 'very_high';
					} else if (card.multiverseId || card.mtgoId) {
						card.initialConfidence = 'high';
					} else if (card.edition && card.collectorNumber) {
						card.initialConfidence = 'high';
					} else if (card.edition && card.name) {
						card.initialConfidence = 'medium';
					} else if (card.name) {
						card.initialConfidence = 'low';
					} else {
						card.initialConfidence = 'low';
					}
				}
			}

			if (progressCallback) progressCallback(20);

			// Step 1: Perform primary lookups (set validation should have happened before conversion)
			const primaryResults = await performPrimaryLookups(parsedCards, progressCallback);

			if (progressCallback) progressCallback(80);

			// Step 2: Language validation and secondary lookups
			const finalResults = await performLanguageValidationAndSecondaryLookups(
				primaryResults,
				defaultCondition,
				progressCallback
			);
			if (progressCallback) progressCallback(100);
			return finalResults;
		},

		// Convert pre-validated cards (used when cards have already been parsed and validated)
		convertPrevalidatedCards: async (
			validatedCards: ParsedCard[],
			progressCallback?: (progress: number) => void,
			defaultCondition?: string
		): Promise<ConversionResult[]> => {
			if (progressCallback) progressCallback(0);

			// Ensure all cards have confidence levels (fallback if missing)
			for (const card of validatedCards) {
				if (!card.initialConfidence) {
					if (card.scryfallId) {
						card.initialConfidence = 'very_high';
					} else if (card.multiverseId || card.mtgoId) {
						card.initialConfidence = 'high';
					} else if (card.edition && card.collectorNumber) {
						card.initialConfidence = card.setCodeCorrected ? 'medium' : 'high';
					} else if (card.edition && card.name) {
						card.initialConfidence = card.setCodeCorrected ? 'medium' : 'medium';
					} else if (card.name) {
						card.initialConfidence = 'low';
					} else {
						card.initialConfidence = 'low';
					}
				}
			}

			if (progressCallback) progressCallback(20);

			// Step 1: Perform primary lookups using the validated cards
			const primaryResults = await performPrimaryLookups(validatedCards, progressCallback);

			if (progressCallback) progressCallback(80);

			// Step 2: Language validation and secondary lookups
			const finalResults = await performLanguageValidationAndSecondaryLookups(
				primaryResults,
				defaultCondition,
				progressCallback
			);

			if (progressCallback) progressCallback(100);

			return finalResults;
		},

		// Check API `hea`lth
		checkApiHealth: async (): Promise<ApiHealthResult> => {
			return await checkScryfallApiHealth();
		}, // Validate set codes in parsed cards (called after parsing, before conversion)
		validateSetCodes: async (cards: ParsedCard[]): Promise<SetValidationResult> => {
			// Debug: Add logging to see what's being detected
			console.log(
				'Set validation input:',
				cards.map((c) => ({ name: c.name, edition: c.edition, editionName: c.editionName }))
			);

			const invalidSetCodes: string[] = [];
			const correctedSetCodes: Array<{
				original: string;
				corrected: string;
				confidence: number;
				setName?: string;
			}> = [];
			const warnings: string[] = [];

			// Get unique set codes from cards (including empty ones where we have set names)
			const setCodes = [...new Set(cards.map((card) => card.edition).filter(Boolean))];

			// Also collect cards that have editionName but no valid edition
			const cardsWithOnlySetNames = cards.filter(
				(card) => card.editionName && (!card.edition || card.edition.trim() === '')
			);

			// Build correction map
			const correctionMap = new Map<string, string>(); // Process invalid set codes
			for (const setCode of setCodes) {
				const isValid = await validateSetCode(setCode!);

				if (!isValid) {
					invalidSetCodes.push(setCode!);

					// Try to find correction using set names from cards with this set code
					const cardsWithThisSet = cards.filter((card) => card.edition === setCode);
					const setNames = [
						...new Set(cardsWithThisSet.map((card) => card.editionName).filter(Boolean))
					];
					let bestCorrection: { code: string; confidence: number; matchedName?: string } | null =
						null;
					for (const setName of setNames) {
						const correction = await findSetCodeByName(setName!, 0.7);

						if (
							correction.code &&
							correction.confidence >= 0.7 &&
							(!bestCorrection || correction.confidence > bestCorrection.confidence)
						) {
							bestCorrection = {
								code: correction.code,
								confidence: correction.confidence,
								matchedName: correction.matchedName
							};
						}
					}
					if (bestCorrection) {
						correctedSetCodes.push({
							original: setCode!,
							corrected: bestCorrection.code,
							confidence: bestCorrection.confidence,
							setName: bestCorrection.matchedName
						});
						correctionMap.set(setCode!, bestCorrection.code);
					} else {
						warnings.push(`Invalid set code "${setCode}" cannot be automatically corrected`);
					}
				}
			}

			// Process cards with only set names (no set codes)
			const uniqueSetNames = [...new Set(cardsWithOnlySetNames.map((card) => card.editionName!))];
			for (const setName of uniqueSetNames) {
				const correction = await findSetCodeByName(setName, 0.7);
				if (correction.code && correction.confidence >= 0.7) {
					correctedSetCodes.push({
						original: '', // No original set code
						corrected: correction.code,
						confidence: correction.confidence,
						setName: correction.matchedName
					});
					// Use setName as key for cards with no set code
					correctionMap.set(`setname:${setName}`, correction.code);
				} else {
					warnings.push(`Set name "${setName}" cannot be matched to a valid set code`);
				}
			} // Apply corrections to cards and update confidence levels
			for (const card of cards) {
				let correctionApplied = false;

				if (card.edition && correctionMap.has(card.edition)) {
					// Case 1: Invalid set code that was corrected
					const correctedCode = correctionMap.get(card.edition)!;
					const correction = correctedSetCodes.find((c) => c.original === card.edition);

					card.edition = correctedCode;
					card.setCodeCorrected = true; // Flag that this set code was corrected
					card.warnings = card.warnings || [];
					card.warnings.push(
						`Set code "${correction?.original}" corrected to "${correctedCode}" based on set name "${correction?.setName}"`
					);
					correctionApplied = true;
				} else if (card.editionName && (!card.edition || card.edition.trim() === '')) {
					// Case 2: Missing set code but we have set name
					const setNameKey = `setname:${card.editionName}`;
					if (correctionMap.has(setNameKey)) {
						const correctedCode = correctionMap.get(setNameKey)!;

						card.edition = correctedCode;
						card.setCodeCorrected = true; // Flag that this set code was added
						card.warnings = card.warnings || [];
						card.warnings.push(
							`Set code added as "${correctedCode}" based on set name "${card.editionName}"`
						);
						correctionApplied = true;
					}
				}

				// Update confidence levels based on identifiers and corrections
				if (card.scryfallId) {
					card.initialConfidence = 'very_high'; // Scryfall ID always wins
				} else if (card.multiverseId || card.mtgoId) {
					card.initialConfidence = 'high'; // ID-based lookups are still high
				} else if (card.edition && card.collectorNumber) {
					if (correctionApplied) {
						// Set + collector number with corrected/added set = medium confidence
						card.initialConfidence = 'medium';
					} else {
						// Valid set + collector number = high confidence
						card.initialConfidence = 'high';
					}
				} else if (card.edition && card.name) {
					if (correctionApplied) {
						// Name + corrected/added set = medium confidence
						card.initialConfidence = 'medium';
					} else {
						// Name + valid set = medium confidence (no correction needed)
						card.initialConfidence = 'medium';
					}
				} else if (card.name) {
					card.initialConfidence = 'low';
					if (!card.edition) {
						card.warnings = card.warnings || [];
						card.warnings.push('Only card name available - correct version unlikely to be found');
					}
				} else {
					card.initialConfidence = 'low';
					card.warnings = card.warnings || [];
					card.warnings.push('No usable identifiers available');
				}

				// Handle cases where set codes couldn't be corrected
				if (card.edition && invalidSetCodes.includes(card.edition) && !correctionApplied) {
					card.warnings = card.warnings || [];
					card.warnings.push(
						`Invalid set code "${card.edition}" - could not be corrected automatically`
					);
					card.initialConfidence = 'low'; // Invalid set code that can't be corrected = low confidence
				}
			}
			return {
				hasInvalidSetCodes: invalidSetCodes.length > 0,
				invalidSetCodes,
				correctedSetCodes,
				warnings
			};
		}
	};
}

// Helper function to detect format from CSV content
export function detectFormatFromContent(csvContent: string): FormatDetectionResult | null {
	// Use PapaParse to properly parse the CSV headers
	const result = Papa.parse(csvContent, {
		header: false,
		skipEmptyLines: true,
		preview: 1 // Only parse the first row to get headers
	});

	if (result.errors.length > 0) {
		console.warn('CSV parsing errors:', result.errors);
	}

	if (result.data.length === 0) return null;

	// Get headers from first row
	const headers = (result.data[0] as string[]).map((h) => h.trim());

	return formatAutoDetector.detectFormat(headers);
}

// Helper function to parse CSV content
async function parseCSVContent(
	csvContent: string,
	formatId: string,
	progressCallback?: (progress: number) => void
): Promise<ParsedCard[]> {
	if (progressCallback) progressCallback(10);

	// Find format
	const allFormats = formatAutoDetector.getAllFormats();
	const format = allFormats.find((f) => f.id === formatId);
	if (!format) {
		throw new Error(`Unknown format: ${formatId}`);
	}

	// Use PapaParse to properly parse the CSV
	const result = Papa.parse(csvContent, {
		header: true,
		skipEmptyLines: true,
		delimiter: format.delimiter || ',',
		transformHeader: (header: string) => header.trim()
	});

	if (result.errors.length > 0) {
		console.warn('CSV parsing errors:', result.errors);
		// Only throw if there are fatal errors
		const fatalErrors = result.errors.filter((error) => error.type === 'Delimiter');
		if (fatalErrors.length > 0) {
			throw new Error(`CSV parsing error: ${fatalErrors[0].message}`);
		}
	}

	if (result.data.length === 0) {
		throw new Error('CSV file is empty or contains no valid data');
	}

	if (progressCallback) progressCallback(20);

	// Parse data rows
	const cards: ParsedCard[] = [];
	const rows = result.data as Record<string, string>[];

	for (let i = 0; i < rows.length; i++) {
		if (progressCallback && i % 100 === 0) {
			const progress = 20 + (i / rows.length) * 60;
			progressCallback(progress);
		}

		const row = rows[i];
		if (!row || Object.keys(row).length === 0) continue;

		try {
			const card = parseCardRow(row, format);
			if (card) {
				cards.push(card);
			}
		} catch (error) {
			console.warn(`Error parsing row ${i + 2}:`, error);
		}
	}
	return cards;
}

// Helper function to parse a single card row
function parseCardRow(row: Record<string, string>, format: CsvFormat): ParsedCard | null {
	// Create base card object
	const card: ParsedCard = {
		originalData: row,
		count: 1,
		name: '',
		edition: '',
		condition: 'Near Mint',
		language: 'English',
		foil: '',
		collectorNumber: '',
		scryfallId: '',
		multiverseId: undefined,
		mtgoId: undefined,
		purchasePrice: '',
		needsLookup: true,
		conversionStatus: 'pending'
	};

	// Apply column mappings
	for (const [cardField, columnName] of Object.entries(format.columnMappings)) {
		if (columnName && row[columnName] !== undefined) {
			let value = row[columnName];

			// Apply transformations if they exist
			if (format.transformations && format.transformations[cardField]) {
				value = format.transformations[cardField](value);
			}

			// Set the value on the card object
			if (cardField === 'count') {
				card.count = parseInt(value) || 1;
			} else if (cardField === 'multiverseId') {
				card.multiverseId = value ? parseInt(value) : undefined;
			} else if (cardField === 'mtgoId') {
				card.mtgoId = value ? parseInt(value) : undefined;
			} else {
				// Use type assertion for dynamic property assignment
				(card as Record<string, string | number | undefined>)[cardField] = value;
			}
		}
	}

	// Validate required fields
	if (!card.name) {
		return null;
	}

	return card;
}

// Helper function to convert ParsedCard to Moxfield row format
function convertCardToMoxfieldRow(
	card: ParsedCard,
	scryfallCard?: ScryfallCard,
	defaultCondition?: string
): Record<string, string> {
	// If we have Scryfall data, use it to fill in missing information
	const edition = card.edition || scryfallCard?.set || '';
	const collectorNumber = card.collectorNumber || scryfallCard?.collector_number || '';
	const name = card.name || scryfallCard?.name || '';

	return {
		Count: card.count.toString(),
		Name: name,
		Edition: edition,
		Condition: card.condition || defaultCondition || 'Near Mint',
		Language: card.language || 'English',
		Foil: card.foil || '',
		Tags: card.tags || '',
		'Last Modified': card.lastModified || '',
		'Collector Number': collectorNumber,
		Alter: card.alter || '',
		Proxy: card.proxy || '',
		'Purchase Price': card.purchasePrice || ''
	};
}

// ===== CONFIDENCE ASSIGNMENT =====

// Assign initial confidence based on available identifiers (no set validation here)
// ===== NEW 3-STEP CONVERSION PROCESS =====

// Step 2: Perform primary lookups using Collection endpoint (PROPERLY MIXING IDENTIFIERS)
async function performPrimaryLookups(
	cards: ParsedCard[],
	progressCallback?: ProgressCallback
): Promise<Array<{ card: ParsedCard; result?: ConversionResult; needsRetry?: boolean }>> {
	const results: Array<{ card: ParsedCard; result?: ConversionResult; needsRetry?: boolean }> = []; // All cards need API lookup to get complete Scryfall data for Moxfield conversion
	const cardsNeedingLookup = cards;

	// No cards are handled without lookup since we need complete Scryfall data

	let processed = 0;
	const total = cardsNeedingLookup.length;

	console.log(
		`Total cards: ${cards.length}, Cards needing API lookup: ${cardsNeedingLookup.length}`
	);

	if (cardsNeedingLookup.length === 0) {
		if (progressCallback) progressCallback(60);
		return results;
	}

	// Process cards that need lookup in batches of 75, mixing all identifier types as Scryfall recommends
	for (let i = 0; i < cardsNeedingLookup.length; i += BATCH_SIZE) {
		const batch = cardsNeedingLookup.slice(i, i + BATCH_SIZE);

		console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} with ${batch.length} cards...`);

		const batchResults = await processCardBatch(batch);
		for (const batchResult of batchResults) {
			results.push({ card: batchResult.originalCard, result: batchResult });
		}
		processed += batch.length;
		if (progressCallback) {
			progressCallback(10 + (processed / total) * 50); // 10-60% range
		}

		// Rate limiting between batches
		if (i + BATCH_SIZE < cardsNeedingLookup.length) {
			await delay(RATE_LIMIT_DELAY);
		}
	}
	return results;
}

// Process a batch of cards with mixed identifiers (as Scryfall recommends)
async function processCardBatch(cards: ParsedCard[]): Promise<ConversionResult[]> {
	const cardIdentifierPairs: Array<{ card: ParsedCard; identifier: CardIdentifier }> = [];

	for (const card of cards) {
		let identifier: CardIdentifier;
		// Create identifier based on best available data (priority order)
		if (card.scryfallId) {
			// Validate and trim Scryfall ID to 36 characters
			let scryfallId = card.scryfallId.trim();
			if (scryfallId.length > 36) {
				scryfallId = scryfallId.substring(0, 36);
				card.warnings = card.warnings || [];
				card.warnings.push('Scryfall ID was longer than 36 characters and has been trimmed');
			}
			console.log(`Using Scryfall ID for ${card.name}: ${scryfallId}`);
			identifier = { id: scryfallId };
		} else if (card.multiverseId) {
			console.log(`Using Multiverse ID for ${card.name}: ${card.multiverseId}`);
			identifier = { multiverse_id: card.multiverseId };
		} else if (card.mtgoId) {
			console.log(`Using MTGO ID for ${card.name}: ${card.mtgoId}`);
			identifier = { mtgo_id: card.mtgoId };
		} else if (card.edition && card.collectorNumber) {
			console.log(`Using Set+CN for ${card.name}: ${card.edition}+${card.collectorNumber}`);
			identifier = { set: card.edition, collector_number: card.collectorNumber };
		} else if (card.name && card.edition) {
			console.log(`Using Name+Set for ${card.name}: ${card.name}+${card.edition}`);
			identifier = { name: card.name, set: card.edition };
		} else if (card.name) {
			console.log(`Using Name only for ${card.name}: ${card.name}`);
			identifier = { name: card.name };
		} else {
			continue; // Skip cards with no valid identifiers
		}

		cardIdentifierPairs.push({ card, identifier });
	}

	return await processBatchWithIdentifiers(cardIdentifierPairs);
}

// Process cards with identifiers using Collection endpoint
async function processBatchWithIdentifiers(
	cardIdentifierPairs: Array<{ card: ParsedCard; identifier: CardIdentifier }>
): Promise<ConversionResult[]> {
	const results: ConversionResult[] = [];

	// Process in batches of up to 75
	for (let i = 0; i < cardIdentifierPairs.length; i += BATCH_SIZE) {
		const batch = cardIdentifierPairs.slice(i, i + BATCH_SIZE);
		const identifiers = batch.map((pair) => pair.identifier);
		const batchCards = batch.map((pair) => pair.card);

		try {
			const response = await fetchScryfallCollection(identifiers);

			// Match successful results back to original cards
			response.data.forEach((scryfallCard) => {
				const originalCard = findMatchingCard(batchCards, scryfallCard);

				if (originalCard) {
					// Validate that the Scryfall data actually matches what was in the CSV
					const validation = validateScryfallMatch(originalCard, scryfallCard);

					if (!validation.isValid) {
						// Data mismatch - treat as failed lookup
						results.push(
							createFailedResult(
								originalCard,
								`Data validation failed: ${validation.errors.join('; ')}`
							)
						);
						return;
					}

					// Create successful result
					results.push(createSuccessfulResult(originalCard, scryfallCard));
				}
			});

			// Handle not found cards
			response.not_found?.forEach((identifier) => {
				const originalCard = findCardByIdentifier(batchCards, identifier);

				if (originalCard) {
					results.push(createFailedResult(originalCard, 'Card not found in Scryfall database'));
				}
			});

			// Rate limiting between batches
			if (i + BATCH_SIZE < cardIdentifierPairs.length) {
				await delay(RATE_LIMIT_DELAY);
			}
		} catch (error) {
			console.error('Error in batch lookup:', error);
			// Add failed results for this batch
			batchCards.forEach((card) => {
				results.push(createFailedResult(card, 'API error during lookup'));
			});
		}
	}

	return results;
}

// Helper to find matching card from Scryfall response
function findMatchingCard(cards: ParsedCard[], scryfallCard: ScryfallCard): ParsedCard | undefined {
	return cards.find((card) => {
		// Try to match by ID first (most reliable)
		if (card.scryfallId && scryfallCard.id === card.scryfallId.trim().substring(0, 36)) {
			return true;
		}
		if (card.multiverseId && scryfallCard.multiverse_ids?.includes(card.multiverseId)) {
			return true;
		}
		if (
			card.mtgoId &&
			(scryfallCard.mtgo_id === card.mtgoId || scryfallCard.mtgo_foil_id === card.mtgoId)
		) {
			return true;
		}

		// Match by set + collector number
		if (card.edition && card.collectorNumber) {
			return (
				scryfallCard.set.toLowerCase() === card.edition.toLowerCase() &&
				scryfallCard.collector_number === card.collectorNumber
			);
		}

		// Match by name + set
		if (card.edition) {
			return (
				scryfallCard.name.toLowerCase() === card.name.toLowerCase() &&
				scryfallCard.set.toLowerCase() === card.edition.toLowerCase()
			);
		}

		// Match by name only (least reliable)
		return scryfallCard.name.toLowerCase() === card.name.toLowerCase();
	});
}

// Helper to find card by identifier for not_found matches
function findCardByIdentifier(
	cards: ParsedCard[],
	identifier: CardIdentifier
): ParsedCard | undefined {
	return cards.find((card) => {
		if (identifier.id && card.scryfallId === identifier.id) {
			return true;
		}
		if (identifier.multiverse_id && card.multiverseId === identifier.multiverse_id) {
			return true;
		}
		if (identifier.mtgo_id && card.mtgoId === identifier.mtgo_id) {
			return true;
		}
		if (identifier.set && identifier.collector_number) {
			return (
				card.edition?.toLowerCase() === identifier.set.toLowerCase() &&
				card.collectorNumber === identifier.collector_number
			);
		}
		if (identifier.name && identifier.set) {
			return (
				card.name.toLowerCase() === identifier.name.toLowerCase() &&
				card.edition?.toLowerCase() === identifier.set.toLowerCase()
			);
		}
		if (identifier.name) {
			return card.name.toLowerCase() === identifier.name.toLowerCase();
		}
		return false;
	});
}

// Helper to create successful result
function createSuccessfulResult(card: ParsedCard, scryfallCard: ScryfallCard): ConversionResult {
	// Start with the initial confidence (from parsing/validation phase)
	let confidence = card.initialConfidence || 'low';
	let identificationMethod: ConversionResult['identificationMethod'] = 'name_only';

	// Determine identification method based on what was actually used
	if (card.scryfallId) {
		identificationMethod = 'scryfall_id';
		// Very high confidence can't be downgraded by other factors
		confidence = 'very_high';
	} else if (card.multiverseId) {
		identificationMethod = 'multiverse_id';
		// Start with high confidence, but check for downgrades
		if (confidence === 'very_high') confidence = 'high'; // Can't be higher than high for multiverse ID
	} else if (card.mtgoId) {
		identificationMethod = 'mtgo_id';
		// Start with high confidence, but check for downgrades
		if (confidence === 'very_high') confidence = 'high'; // Can't be higher than high for MTGO ID
	} else if (card.edition && card.collectorNumber) {
		if (card.setCodeCorrected) {
			identificationMethod = 'set_collector_corrected';
			// Medium confidence for corrected set codes (as per requirements)
			if (confidence !== 'low') confidence = 'medium';
		} else {
			identificationMethod = 'set_collector';
			// High confidence for valid set + collector (if not already downgraded)
		}
	} else if (card.edition) {
		if (card.setCodeCorrected) {
			identificationMethod = 'name_set_corrected';
			// Medium confidence for corrected set codes (as per requirements)
			if (confidence !== 'low') confidence = 'medium';
		} else {
			identificationMethod = 'name_set';
			// Medium confidence for name + valid set (if not already downgraded)
		}
	} else {
		identificationMethod = 'name_only';
		confidence = 'low'; // Name only is always low
	}
	// Language mismatch handling is now done in performLanguageValidationAndSecondaryLookups
	// This function just creates the basic result structure

	return {
		originalCard: card,
		scryfallCard,
		moxfieldRow: convertCardToMoxfieldRow(card, scryfallCard),
		success: true,
		confidence,
		initialConfidence: card.initialConfidence,
		identificationMethod,
		warnings: card.warnings,
		setCodeCorrected: card.setCodeCorrected
	};
}

// Helper function to downgrade confidence levels
function downgradeConfidence(
	confidence: ConversionResult['confidence']
): ConversionResult['confidence'] {
	switch (confidence) {
		case 'very_high':
			return 'high';
		case 'high':
			return 'medium';
		case 'medium':
			return 'low';
		case 'low':
		default:
			return 'low'; // Can't go lower
	}
}

// Helper to create failed result
function createFailedResult(card: ParsedCard, errorMessage: string): ConversionResult {
	return {
		originalCard: card,
		moxfieldRow: convertCardToMoxfieldRow(card),
		success: false,
		confidence: 'low',
		initialConfidence: card.initialConfidence,
		identificationMethod: 'failed',
		error: errorMessage,
		warnings: card.warnings,
		setCodeCorrected: card.setCodeCorrected
	};
}

// Step 3: Language validation and secondary lookups
async function performLanguageValidationAndSecondaryLookups(
	primaryResults: Array<{ card: ParsedCard; result?: ConversionResult; needsRetry?: boolean }>,
	defaultCondition?: string,
	progressCallback?: ProgressCallback
): Promise<ConversionResult[]> {
	const finalResults: ConversionResult[] = [];
	let processed = 0;
	const total = primaryResults.length;

	for (const primaryResult of primaryResults) {
		if (!primaryResult.result) {
			// This shouldn't happen, but handle gracefully
			finalResults.push(createFailedResult(primaryResult.card, 'No primary result available'));
			processed++;
			continue;
		}

		const { card, result } = primaryResult;

		// If lookup failed or no Scryfall card, add as-is
		if (!result.success || !result.scryfallCard) {
			finalResults.push(result);
			processed++;
			continue;
		}

		// Check language match if language was specified
		if (card.language && card.language.trim() !== '') {
			const languageMatch = validateLanguageMatch(card.language, result.scryfallCard.lang);

			if (!languageMatch) {
				// Language mismatch detected
				console.log(
					`Language mismatch for ${card.name}: requested "${card.language}", got "${result.scryfallCard.lang}"`
				);

				// Check if this was a name-only lookup - if so, don't attempt secondary lookup
				const isNameOnlyLookup = result.identificationMethod === 'name_only';

				if (isNameOnlyLookup) {
					// For name-only entries, pass through the source language but warn about potential issues
					console.log(`Skipping language lookup for name-only card: ${card.name}`);
					const updatedResult = { ...result };

					// Get proper Scryfall language code for output
					const scryfallLanguageCode = getScryfallLanguageCode(card.language);
					if (scryfallLanguageCode) {
						// Update the result to use the requested language
						updatedResult.scryfallCard = {
							...result.scryfallCard,
							lang: scryfallLanguageCode
						};
					}

					// Downgrade confidence and add warning
					updatedResult.confidence = downgradeConfidence(result.confidence);
					updatedResult.languageMismatch = true;
					updatedResult.warnings = [
						...(result.warnings || []),
						`Language mismatch for name-only lookup: requested "${card.language}", using original data with confidence downgrade`
					];

					finalResults.push(updatedResult);
				} else {
					// Attempt secondary lookup with specific language using Search endpoint
					const scryfallLanguageCode = getScryfallLanguageCode(card.language);

					if (
						scryfallLanguageCode &&
						result.scryfallCard.set &&
						result.scryfallCard.collector_number
					) {
						try {
							console.log(
								`Attempting language-specific lookup for ${card.name} in ${scryfallLanguageCode}`
							);

							// Add rate limiting delay before secondary lookup
							await delay(RATE_LIMIT_DELAY);

							const languageSpecificCard = await fetchScryfallCardByLanguage(
								result.scryfallCard.set,
								result.scryfallCard.collector_number,
								scryfallLanguageCode
							);

							if (languageSpecificCard) {
								// Found language-specific version
								console.log(`Found language-specific card for ${card.name}`);
								const languageResult = createSuccessfulResult(card, languageSpecificCard);

								// Downgrade confidence due to language mismatch correction
								languageResult.confidence = downgradeConfidence(languageResult.confidence);
								languageResult.languageMismatch = true;
								languageResult.warnings = [
									...(languageResult.warnings || []),
									`Language corrected: found "${scryfallLanguageCode}" version via secondary lookup`
								];

								finalResults.push(languageResult);
							} else {
								// Language-specific version not found, fall back to original with warning
								console.log(
									`Language-specific card not found for ${card.name}, falling back to original`
								);
								const fallbackResult = { ...result };

								fallbackResult.confidence = downgradeConfidence(result.confidence);
								fallbackResult.languageMismatch = true;
								fallbackResult.warnings = [
									...(result.warnings || []),
									`Language mismatch: requested "${card.language}", "${scryfallLanguageCode}" version not available, using "${result.scryfallCard.lang}" version`
								];

								finalResults.push(fallbackResult);
							}
						} catch (error) {
							console.error(`Error during language-specific lookup for ${card.name}:`, error);

							// Fall back to original result with warning about failed lookup
							const errorResult = { ...result };
							errorResult.confidence = downgradeConfidence(result.confidence);
							errorResult.languageMismatch = true;
							errorResult.warnings = [
								...(result.warnings || []),
								`Language mismatch: requested "${card.language}", secondary lookup failed, using "${result.scryfallCard.lang}" version`
							];

							finalResults.push(errorResult);
						}
					} else {
						// Invalid language code or missing set/collector info
						const updatedResult = { ...result };
						updatedResult.confidence = downgradeConfidence(result.confidence);
						updatedResult.languageMismatch = true;

						if (!scryfallLanguageCode) {
							updatedResult.warnings = [
								...(result.warnings || []),
								`Language mismatch: unrecognized language "${card.language}", using "${result.scryfallCard.lang}" version`
							];
						} else {
							updatedResult.warnings = [
								...(result.warnings || []),
								`Language mismatch: requested "${card.language}", cannot perform secondary lookup (missing set/collector info), using "${result.scryfallCard.lang}" version`
							];
						}

						finalResults.push(updatedResult);
					}
				}
			} else {
				// Language matches or validates correctly
				finalResults.push(result);
			}
		} else {
			// No language specified
			finalResults.push(result);
		}

		processed++;
		if (progressCallback) {
			const progress = 80 + (processed / total) * 20; // 80-100% range
			progressCallback(Math.min(100, progress));
		}
	}

	if (progressCallback) progressCallback(100);

	return finalResults;
}

// Function to get Scryfall language code from various input formats
function getScryfallLanguageCode(inputLanguage: string): string | null {
	if (!inputLanguage || inputLanguage.trim() === '') {
		return null;
	}

	const normalizedInput = inputLanguage.toLowerCase().trim();

	// Check if input is already a valid Scryfall language code
	if (Object.keys(LANGUAGE_MAPPINGS).includes(normalizedInput)) {
		return normalizedInput;
	}

	// Find matching Scryfall language code from aliases
	for (const [scryfallCode, aliases] of Object.entries(LANGUAGE_MAPPINGS)) {
		if (aliases.some((alias) => alias.toLowerCase() === normalizedInput)) {
			return scryfallCode;
		}
	}

	return null; // Unknown language
}

// Fetch card using Search endpoint with specific language
async function fetchScryfallCardByLanguage(
	setCode: string,
	collectorNumber: string,
	languageCode: string
): Promise<ScryfallCard | null> {
	try {
		const query = `e:${setCode} cn:${collectorNumber} lang:${languageCode}`;
		const encodedQuery = encodeURIComponent(query);
		const url = `https://api.scryfall.com/cards/search?q=${encodedQuery}`;

		console.log(`Searching for card with language: ${url}`);

		const response = await fetch(url, {
			headers: {
				'User-Agent': 'Omenpath/1.0',
				Accept: 'application/json'
			}
		});

		if (!response.ok) {
			if (response.status === 404) {
				// No cards found - this is expected for language mismatches
				console.log(`No cards found for language query: ${query}`);
				return null;
			}

			const errorText = await response.text();
			console.error(
				`Scryfall Search API error: ${response.status} ${response.statusText}`,
				errorText
			);
			throw new Error(`Scryfall Search API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();

		if (data.data && data.data.length > 0) {
			console.log(`Found ${data.data.length} card(s) for language query`);
			return data.data[0]; // Return first match
		}

		return null;
	} catch (error) {
		console.error('Error fetching card by language:', error);
		throw error;
	}
}
