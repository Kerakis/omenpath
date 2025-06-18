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
	// Validate name match (only if name was provided in original)
	if (
		originalCard.name &&
		originalCard.name.trim() !== '' &&
		originalCard.name.toLowerCase() !== scryfallCard.name.toLowerCase()
	) {
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
	const baseHeaders = [
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

	// Check if any results have warnings or errors
	const hasIssues = results.some(
		(result) => !result.success || result.error || (result.warnings && result.warnings.length > 0)
	);
	// Add Notes column if there are any issues
	const headers = hasIssues ? [...baseHeaders, 'Notes'] : baseHeaders;
	const csvLines = [headers.map((h) => `"${h}"`).join(',')];

	// Use the results in their current order (already sorted during conversion)
	// Only re-assign output row numbers if they weren't already assigned
	const needsRowNumbers = results.some((r) => !r.outputRowNumber);
	if (needsRowNumbers) {
		results.forEach((result, index) => {
			result.outputRowNumber = index + 2; // 1-based, accounting for header
		});
	}

	results.forEach((result) => {
		const row = baseHeaders.map((header) => {
			const value = result.moxfieldRow[header] || '';
			return `"${value.replace(/"/g, '""')}"`;
		});

		// Add Notes column if needed
		if (hasIssues) {
			const notes = [];
			if (!result.success || result.error) {
				notes.push(`ERROR: ${result.error || 'Conversion failed'}`);
			}
			if (result.warnings && result.warnings.length > 0) {
				notes.push(...result.warnings.map((w) => `WARNING: ${w}`));
			}
			const notesValue = notes.join('; ');
			row.push(`"${notesValue.replace(/"/g, '""')}"`);
		}

		csvLines.push(row.join(','));
	});

	return csvLines.join('\n');
}

// Format results as TXT for MTG Arena import with warnings/errors as comments
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
			if (progressCallback) progressCallback(20); // Step 1: Handle special case of name + collector number (no set)
			const { processedCards, nameOnlyCards } =
				await performNameAndCollectorNumberLookups(parsedCards);

			// Create results for cards that were successfully found via search
			const searchResults: ConversionResult[] = [];
			for (const card of processedCards) {
				if (card.foundViaNameCollectorSearch && card.scryfallCardData) {
					// Use the stored Scryfall card data directly - no need for additional API calls
					searchResults.push(createSuccessfulResult(card, card.scryfallCardData));
				} else {
					// Card without stored data should go to primary lookup
					nameOnlyCards.push(card);
				}
			}

			// Only send nameOnlyCards (fallback cases) to the collection endpoint
			const allCardsForPrimaryLookup = nameOnlyCards;

			if (progressCallback) progressCallback(30);

			// Step 2: Perform primary lookups (set validation should have happened before conversion)
			const primaryResults = await performPrimaryLookups(
				allCardsForPrimaryLookup,
				progressCallback
			);
			if (progressCallback) progressCallback(80);

			// Step 3: Language validation and secondary lookups
			const finalResults = await performLanguageValidationAndSecondaryLookups(
				primaryResults,
				defaultCondition,
				progressCallback
			);

			// Combine search results with final results
			const allResults = [...searchResults, ...finalResults];

			// Sort results and assign output row numbers for preview display
			// Sort: errors first, then warnings, then successful entries
			const sortedResults = [...allResults].sort((a, b) => {
				// Priority: errors (0), warnings (1), success (2)
				const aPriority = !a.success || a.error ? 0 : a.warnings && a.warnings.length > 0 ? 1 : 2;
				const bPriority = !b.success || b.error ? 0 : b.warnings && b.warnings.length > 0 ? 1 : 2;

				if (aPriority !== bPriority) {
					return aPriority - bPriority;
				}

				// Within same priority, sort alphabetically by name
				const aName = a.moxfieldRow.Name || '';
				const bName = b.moxfieldRow.Name || '';
				return aName.localeCompare(bName);
			});

			// Assign output row numbers (1-based, accounting for header)
			sortedResults.forEach((result, index) => {
				result.outputRowNumber = index + 2;
			});

			if (progressCallback) progressCallback(100);
			return sortedResults;
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
			if (progressCallback) progressCallback(20); // Step 1: Handle special case of name + collector number (no set)
			const { processedCards, nameOnlyCards } =
				await performNameAndCollectorNumberLookups(validatedCards); // Create results for cards that were successfully found via search
			const searchResults: ConversionResult[] = [];
			for (const card of processedCards) {
				if (card.foundViaNameCollectorSearch && card.scryfallCardData) {
					// Use the stored Scryfall card data directly - no need for additional API calls
					searchResults.push(createSuccessfulResult(card, card.scryfallCardData));
				} else {
					// Card without stored data should go to primary lookup
					nameOnlyCards.push(card);
				}
			}

			// Only send nameOnlyCards (fallback cases) to the collection endpoint
			const allCardsForPrimaryLookup = nameOnlyCards;

			if (progressCallback) progressCallback(30);

			// Step 2: Perform primary lookups using the validated cards
			const primaryResults = await performPrimaryLookups(
				allCardsForPrimaryLookup,
				progressCallback
			);
			if (progressCallback) progressCallback(80); // Step 3: Language validation and secondary lookups
			const finalResults = await performLanguageValidationAndSecondaryLookups(
				primaryResults,
				defaultCondition,
				progressCallback
			);

			// Combine search results with final results
			const allResults = [...searchResults, ...finalResults];

			// Sort results and assign output row numbers for preview display
			// Sort: errors first, then warnings, then successful entries
			const sortedResults = [...allResults].sort((a, b) => {
				// Priority: errors (0), warnings (1), success (2)
				const aPriority = !a.success || a.error ? 0 : a.warnings && a.warnings.length > 0 ? 1 : 2;
				const bPriority = !b.success || b.error ? 0 : b.warnings && b.warnings.length > 0 ? 1 : 2;

				if (aPriority !== bPriority) {
					return aPriority - bPriority;
				}

				// Within same priority, sort alphabetically by name
				const aName = a.moxfieldRow.Name || '';
				const bName = b.moxfieldRow.Name || '';
				return aName.localeCompare(bName);
			});

			// Assign output row numbers (1-based, accounting for header)
			sortedResults.forEach((result, index) => {
				result.outputRowNumber = index + 2;
			});

			if (progressCallback) progressCallback(100);

			return sortedResults;
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
				} // Update confidence levels based on identifiers and corrections
				if (card.scryfallId) {
					card.initialConfidence = 'very_high'; // Scryfall ID always wins
				} else if (card.multiverseId || card.mtgoId) {
					card.initialConfidence = 'high'; // ID-based lookups are still high
				} else if (card.edition && card.collectorNumber) {
					// Set + collector number works even without name
					if (correctionApplied) {
						// Set + collector number with corrected/added set = medium confidence
						card.initialConfidence = 'medium';
					} else {
						// Valid set + collector number = high confidence
						card.initialConfidence = 'high';
					}
					// Add warning if name is missing for set + collector number
					if (!card.name || card.name.trim() === '') {
						card.warnings = card.warnings || [];
						card.warnings.push('Missing card name - using set + collector number for lookup');
					}
				} else if (card.editionName && card.collectorNumber) {
					// Set name + collector number (with potential fuzzy set code match)
					if (correctionApplied) {
						card.initialConfidence = 'medium';
					} else {
						card.initialConfidence = 'medium'; // Fuzzy match is inherently medium confidence
					}
					// Add warning if name is missing for set name + collector number
					if (!card.name || card.name.trim() === '') {
						card.warnings = card.warnings || [];
						card.warnings.push('Missing card name - using set name + collector number for lookup');
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
					// Only add "only card name available" warning if the card doesn't have collector number
					// Cards with name + collector number will be handled by special lookup
					if (!card.edition && !card.collectorNumber) {
						card.warnings = card.warnings || [];
						card.warnings.push('Only card name available - correct version unlikely to be found');
					}
				} else {
					// No name and no usable identifiers
					card.initialConfidence = 'low';
					card.warnings = card.warnings || [];

					// Check what identifiers are available to provide specific guidance
					const hasUsableIds =
						card.scryfallId ||
						card.multiverseId ||
						card.mtgoId ||
						(card.edition && card.collectorNumber) ||
						(card.editionName && card.collectorNumber);

					if (hasUsableIds) {
						// This shouldn't happen due to the logic above, but just in case
						card.warnings.push('Missing card name but other identifiers available');
					} else {
						card.warnings.push(
							'Will fail conversion - no usable identifiers available (need name, or set+collector#, or Scryfall/Multiverse/MTGO ID)'
						);
					}
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
			const card = parseCardRow(row, format, i + 2); // Row number is i + 2 (1-based, accounting for header)
			if (card) {
				console.log(`Parsed card from row ${i + 2}:`, {
					name: card.name,
					language: card.language,
					edition: card.edition,
					collectorNumber: card.collectorNumber,
					multiverseId: card.multiverseId,
					scryfallId: card.scryfallId
				});
				cards.push(card);
			}
		} catch (error) {
			console.warn(`Error parsing row ${i + 2}:`, error);
		}
	}
	return cards;
}

// Helper function to parse a single card row
function parseCardRow(
	row: Record<string, string>,
	format: CsvFormat,
	rowNumber: number
): ParsedCard | null {
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
		conversionStatus: 'pending',
		sourceRowNumber: rowNumber
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
	} // Don't exclude cards based on missing name - all entries should be shown in preview
	// Cards with insufficient data will get appropriate warnings and fail during conversion

	// Add preview warnings for special cases
	if (
		card.name &&
		card.collectorNumber &&
		!card.edition &&
		!card.editionName &&
		!card.scryfallId &&
		!card.multiverseId &&
		!card.mtgoId
	) {
		// Card has name + collector number but no set info or other identifiers - will attempt special lookup
		card.warnings = card.warnings || [];
		card.warnings.push(
			'Will attempt to find correct printing using name + collector number during conversion'
		);
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

// Step 1.5: Handle special case of name + collector number (no set)
async function performNameAndCollectorNumberLookups(
	cards: ParsedCard[]
): Promise<{ processedCards: ParsedCard[]; nameOnlyCards: ParsedCard[] }> {
	const processedCards: ParsedCard[] = [];
	const nameOnlyCards: ParsedCard[] = [];
	for (const card of cards) {
		// Check if this card has name + collector number but no set AND no other identifiers
		// Cards with existing Scryfall ID, Multiverse ID, or MTGO ID should skip this lookup
		if (
			card.name &&
			card.collectorNumber &&
			!card.edition &&
			!card.editionName &&
			!card.scryfallId &&
			!card.multiverseId &&
			!card.mtgoId
		) {
			console.log(
				`Attempting name + collector number lookup for: ${card.name} (CN: ${card.collectorNumber})`
			);

			try {
				// Search for exact card name with collector number using search endpoint
				const searchQuery = `!"${card.name}" cn:${card.collectorNumber}`;
				const encodedQuery = encodeURIComponent(searchQuery);
				const searchUrl = `https://api.scryfall.com/cards/search?q=${encodedQuery}`;

				console.log(`Search URL: ${searchUrl}`);

				const response = await fetch(searchUrl);
				await delay(RATE_LIMIT_DELAY); // Rate limiting

				if (response.ok) {
					const searchResult = await response.json();

					// Only use result if exactly one card is returned
					if (searchResult.data && searchResult.data.length === 1) {
						const scryfallCard = searchResult.data[0];
						console.log(
							`Found unique match for ${card.name}: ${scryfallCard.set} ${scryfallCard.collector_number}`
						); // Update the card with the found set information and store the full Scryfall data
						const updatedCard: ParsedCard = {
							...card,
							edition: scryfallCard.set,
							scryfallId: scryfallCard.id,
							initialConfidence: 'medium' as const, // Medium confidence for name+collector# search
							foundViaNameCollectorSearch: true, // Flag to indicate special search method
							scryfallCardData: scryfallCard, // Store the full Scryfall card data
							warnings: [
								...(card.warnings || []),
								`Found set "${scryfallCard.set}" via name + collector number search`
							]
						};
						processedCards.push(updatedCard);
					} else {
						console.log(
							`Multiple or no results for ${card.name} CN:${card.collectorNumber}, falling back to name-only`
						); // Multiple results or no results - fall back to name-only lookup
						nameOnlyCards.push({
							...card,
							initialConfidence: 'low' as const,
							warnings: [
								...(card.warnings || []),
								'Name + collector number search returned multiple/no results, using name-only lookup'
							]
						});
					}
				} else {
					console.log(`Search failed for ${card.name}, falling back to name-only`); // Search failed - fall back to name-only lookup
					nameOnlyCards.push({
						...card,
						initialConfidence: 'low' as const,
						warnings: [
							...(card.warnings || []),
							'Name + collector number search failed, using name-only lookup'
						]
					});
				}
			} catch (error) {
				console.log(`Error during name + collector number search for ${card.name}:`, error); // Error occurred - fall back to name-only lookup
				nameOnlyCards.push({
					...card,
					initialConfidence: 'low' as const,
					warnings: [
						...(card.warnings || []),
						'Name + collector number search error, using name-only lookup'
					]
				});
			}
		} else {
			// Card doesn't match the special case criteria
			processedCards.push(card);
		}
	}

	return { processedCards, nameOnlyCards };
}

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
	const cardsWithoutIdentifiers: ParsedCard[] = [];
	for (const card of cards) {
		console.log(`Processing card from row ${card.sourceRowNumber}:`, {
			name: card.name,
			language: card.language,
			edition: card.edition,
			collectorNumber: card.collectorNumber,
			multiverseId: card.multiverseId,
			scryfallId: card.scryfallId
		});

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
			console.log(`Using Scryfall ID for ${card.name || 'unnamed card'}: ${scryfallId}`);
			identifier = { id: scryfallId };
		} else if (card.multiverseId) {
			console.log(`Using Multiverse ID for ${card.name || 'unnamed card'}: ${card.multiverseId}`);
			identifier = { multiverse_id: card.multiverseId };
		} else if (card.mtgoId) {
			console.log(`Using MTGO ID for ${card.name || 'unnamed card'}: ${card.mtgoId}`);
			identifier = { mtgo_id: card.mtgoId };
		} else if (card.edition && card.collectorNumber) {
			console.log(
				`Using Set+CN for ${card.name || 'unnamed card'}: ${card.edition}+${card.collectorNumber}`
			);
			identifier = { set: card.edition, collector_number: card.collectorNumber };
		} else if (card.name && card.edition) {
			console.log(`Using Name+Set for ${card.name}: ${card.name}+${card.edition}`);
			identifier = { name: card.name, set: card.edition };
		} else if (card.name) {
			console.log(`Using Name only for ${card.name}: ${card.name}`);
			identifier = { name: card.name };
		} else {
			// Collect cards with no valid identifiers to create failed results
			console.log(`Card with no valid identifiers: ${JSON.stringify(card.originalData)}`);
			cardsWithoutIdentifiers.push(card);
			continue;
		}

		cardIdentifierPairs.push({ card, identifier });
	}

	// Process cards with identifiers via API
	const apiResults =
		cardIdentifierPairs.length > 0 ? await processBatchWithIdentifiers(cardIdentifierPairs) : [];

	// Create failed results for cards without identifiers
	const failedResults = cardsWithoutIdentifiers.map((card) =>
		createFailedResult(card, 'No usable identifiers available for lookup')
	);

	return [...apiResults, ...failedResults];
}

// Process cards with identifiers using Collection endpoint
async function processBatchWithIdentifiers(
	cardIdentifierPairs: Array<{ card: ParsedCard; identifier: CardIdentifier }>
): Promise<ConversionResult[]> {
	const results: ConversionResult[] = [];

	// Process in batches of up to 75
	for (let i = 0; i < cardIdentifierPairs.length; i += BATCH_SIZE) {
		const batch = cardIdentifierPairs.slice(i, i + BATCH_SIZE);

		// Deduplicate identifiers and keep track of which cards map to each
		const identifierMap = new Map<string, { identifier: CardIdentifier; cards: ParsedCard[] }>();

		batch.forEach(({ card, identifier }) => {
			const identifierKey = JSON.stringify(identifier);
			if (!identifierMap.has(identifierKey)) {
				identifierMap.set(identifierKey, { identifier, cards: [] });
			}
			identifierMap.get(identifierKey)!.cards.push(card);
		});

		const uniqueIdentifiers = Array.from(identifierMap.values()).map((item) => item.identifier);

		try {
			const response = await fetchScryfallCollection(uniqueIdentifiers);

			// Match successful results back to original cards
			response.data.forEach((scryfallCard) => {
				// Find the identifier that matches this Scryfall result
				for (const [identifierKey, { identifier, cards }] of identifierMap.entries()) {
					if (isIdentifierMatch(identifier, scryfallCard)) {
						// Apply this result to ALL cards that used this identifier
						cards.forEach((originalCard) => {
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

							// Create successful result preserving original card properties
							results.push(createSuccessfulResult(originalCard, scryfallCard));
						});

						// Remove this identifier from the map so we don't process it again
						identifierMap.delete(identifierKey);
						break;
					}
				}
			});

			// Handle not found cards
			response.not_found?.forEach((notFoundIdentifier) => {
				// Find cards that used this identifier
				for (const [identifierKey, { identifier, cards }] of identifierMap.entries()) {
					if (JSON.stringify(identifier) === JSON.stringify(notFoundIdentifier)) {
						cards.forEach((originalCard) => {
							results.push(createFailedResult(originalCard, 'Card not found in Scryfall database'));
						});
						identifierMap.delete(identifierKey);
						break;
					}
				}
			});

			// Rate limiting between batches
			if (i + BATCH_SIZE < cardIdentifierPairs.length) {
				await delay(RATE_LIMIT_DELAY);
			}
		} catch (error) {
			console.error('Error in batch lookup:', error);
			// Add failed results for this batch
			batch.forEach(({ card }) => {
				results.push(createFailedResult(card, 'API error during lookup'));
			});
		}
	}

	return results;
}

// Helper function to check if an identifier matches a Scryfall card
function isIdentifierMatch(identifier: CardIdentifier, scryfallCard: ScryfallCard): boolean {
	if (identifier.id && scryfallCard.id === identifier.id.trim().substring(0, 36)) {
		return true;
	}
	if (identifier.multiverse_id && scryfallCard.multiverse_ids?.includes(identifier.multiverse_id)) {
		return true;
	}
	if (
		identifier.mtgo_id &&
		(scryfallCard.mtgo_id === identifier.mtgo_id ||
			scryfallCard.mtgo_foil_id === identifier.mtgo_id)
	) {
		return true;
	}
	if (identifier.set && identifier.collector_number) {
		return (
			scryfallCard.set.toLowerCase() === identifier.set.toLowerCase() &&
			scryfallCard.collector_number === identifier.collector_number
		);
	}
	if (identifier.name && identifier.set) {
		return (
			scryfallCard.name.toLowerCase() === identifier.name.toLowerCase() &&
			scryfallCard.set.toLowerCase() === identifier.set.toLowerCase()
		);
	}
	if (identifier.name) {
		return scryfallCard.name.toLowerCase() === identifier.name.toLowerCase();
	}
	return false;
}

// Helper to create successful result
function createSuccessfulResult(card: ParsedCard, scryfallCard: ScryfallCard): ConversionResult {
	// Start with the initial confidence (from parsing/validation phase)
	let confidence = card.initialConfidence || 'low';
	let identificationMethod: ConversionResult['identificationMethod'] = 'name_only';
	// Determine identification method based on what was actually used
	if (card.foundViaNameCollectorSearch) {
		// Special case: Card found via name + collector number search
		identificationMethod = 'name_collector';
		// Keep the medium confidence already set, don't upgrade to very_high
		confidence = card.initialConfidence || 'medium';
	} else if (card.scryfallId) {
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
		setCodeCorrected: card.setCodeCorrected,
		sourceRowNumber: card.sourceRowNumber
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
		setCodeCorrected: card.setCodeCorrected,
		sourceRowNumber: card.sourceRowNumber
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
		} // Check language match if language was specified
		if (card.language && card.language.trim() !== '') {
			console.log(
				`Processing language validation for ${card.name}: requested "${card.language}", got "${result.scryfallCard.lang}", method: "${result.identificationMethod}"`
			);

			const isNameOnlyLookup = result.identificationMethod === 'name_only';

			if (isNameOnlyLookup) {
				// For name-only entries, simply pass the source language to output without validation
				console.log(`Name-only lookup for ${card.name}: using source language ${card.language}`);
				const updatedResult = { ...result };

				// Get proper Scryfall language code for output
				const scryfallLanguageCode = getScryfallLanguageCode(card.language);
				if (scryfallLanguageCode) {
					// Update the result to use the requested language for output
					updatedResult.scryfallCard = {
						...result.scryfallCard,
						lang: scryfallLanguageCode
					};
				}

				// No confidence downgrade or warnings for name-only lookups
				finalResults.push(updatedResult);
			} else {
				// For non-name-only lookups, check if languages match
				const languageMatch = validateLanguageMatch(card.language, result.scryfallCard.lang);
				console.log(
					`Language match result for ${card.name}: ${languageMatch} (requested: "${card.language}", got: "${result.scryfallCard.lang}")`
				);

				if (!languageMatch) {
					// True language mismatch detected - attempt secondary lookup
					console.log(
						`Language mismatch for ${card.name}: requested "${card.language}", got "${result.scryfallCard.lang}"`
					);

					const scryfallLanguageCode = getScryfallLanguageCode(card.language);
					console.log(`Scryfall language code for "${card.language}": ${scryfallLanguageCode}`);

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
								// Found language-specific version - this is a complete success
								console.log(`Found language-specific card for ${card.name}`);
								const languageResult = createSuccessfulResult(card, languageSpecificCard);
								finalResults.push(languageResult);
							} else {
								// Language-specific version not found - THIS IS THE ONLY TRUE MISMATCH
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

							// Fall back to original result with warning about failed lookup - THIS IS A TRUE MISMATCH
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
						// Invalid language code or missing set/collector info - THIS IS A TRUE MISMATCH
						console.log(
							`Cannot perform secondary lookup for ${card.name}: scryfallLanguageCode=${scryfallLanguageCode}, set=${result.scryfallCard.set}, collector_number=${result.scryfallCard.collector_number}`
						);
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
				} else {
					// Language matches (including aliases) - use Collection endpoint data as-is
					console.log(`Language matches for ${card.name}, using Collection endpoint data`);
					finalResults.push(result);
				}
			}
		} else {
			// No language specified - use Collection endpoint data as-is
			console.log(`No language specified for ${card.name}, using Collection endpoint data`);
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
