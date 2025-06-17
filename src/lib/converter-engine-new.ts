import type {
	ConverterEngine,
	ParsedCard,
	ConversionResult,
	CsvFormat,
	ScryfallResponse,
	CardIdentifier,
	ProgressCallback,
	ScryfallCard
} from './types.js';
import { formatAutoDetector, type FormatDetectionResult } from './formats/index.js';
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
	}
	// Validate language match (if provided in original)
	if (originalCard.language && originalCard.language.trim() !== '') {
		if (!validateLanguageMatch(originalCard.language, scryfallCard.lang)) {
			errors.push(
				`Language mismatch: expected "${originalCard.language}", got "${scryfallCard.lang}"`
			);
		}
	}

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

async function lookupCardsWithScryfall(
	cards: ParsedCard[],
	progressCallback?: ProgressCallback,
	defaultCondition?: string
): Promise<ConversionResult[]> {
	const results: ConversionResult[] = [];
	// Create identifiers for all cards using the best available data
	const cardIdentifierPairs: { card: ParsedCard; identifier: CardIdentifier }[] = cards.map(
		(card) => {
			let identifier: CardIdentifier;

			// Use the best identifier available, following the API's hierarchy
			if (card.scryfallId) {
				identifier = { id: card.scryfallId };
			} else if (card.multiverseId) {
				identifier = { multiverse_id: card.multiverseId };
			} else if (card.mtgoId) {
				identifier = { mtgo_id: card.mtgoId };
			} else if (card.edition && card.collectorNumber) {
				// Use set + collector_number (most precise for name-based lookup)
				identifier = {
					set: card.edition,
					collector_number: card.collectorNumber
				};
			} else if (card.edition && card.name) {
				// Use name + set
				identifier = {
					name: card.name,
					set: card.edition
				};
			} else if (card.name) {
				// Use name only (least precise)
				identifier = { name: card.name };
			} else {
				// No valid identifier - this shouldn't happen but handle it
				identifier = { name: card.name || 'Unknown Card' };
			}

			return { card, identifier };
		}
	);
	let processedCount = 0;
	const totalCards = cards.length;

	// Process all cards in batches of up to 75
	for (let i = 0; i < cardIdentifierPairs.length; i += BATCH_SIZE) {
		const batch = cardIdentifierPairs.slice(i, i + BATCH_SIZE);
		const identifiers = batch.map((pair) => pair.identifier);
		const batchCards = batch.map((pair) => pair.card);

		try {
			const response = await fetchScryfallCollection(identifiers); // Match successful results back to original cards
			response.data.forEach((scryfallCard) => {
				const originalCard = batchCards.find((card) => {
					// Try to match by ID first (most reliable)
					if (card.scryfallId && scryfallCard.id === card.scryfallId) {
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

				if (originalCard) {
					// Validate that the Scryfall data actually matches what was in the CSV
					const validation = validateScryfallMatch(originalCard, scryfallCard);

					if (!validation.isValid) {
						// Data mismatch - treat as failed lookup
						results.push({
							originalCard,
							moxfieldRow: convertCardToMoxfieldRow(originalCard, undefined, defaultCondition),
							success: false,
							confidence: 'low',
							identificationMethod: 'failed',
							error: `Data validation failed: ${validation.errors.join('; ')}`
						});
						return;
					}

					// Determine confidence and identification method
					let confidence: 'high' | 'medium' | 'low' = 'low';
					let identificationMethod: ConversionResult['identificationMethod'] = 'name_only';

					if (originalCard.scryfallId) {
						confidence = 'high';
						identificationMethod = 'scryfall_id';
					} else if (originalCard.multiverseId) {
						confidence = 'high';
						identificationMethod = 'multiverse_id';
					} else if (originalCard.mtgoId) {
						confidence = 'high';
						identificationMethod = 'mtgo_id';
					} else if (originalCard.edition && originalCard.collectorNumber) {
						confidence = 'high';
						identificationMethod = 'set_collector';
					} else if (originalCard.edition) {
						confidence = 'medium';
						identificationMethod = 'name_set';
					} else {
						confidence = 'low';
						identificationMethod = 'name_only';
					}

					results.push({
						originalCard,
						scryfallCard,
						moxfieldRow: convertCardToMoxfieldRow(originalCard, scryfallCard, defaultCondition),
						success: true,
						confidence,
						identificationMethod
					});
				}
			});

			// Handle not found cards
			response.not_found?.forEach((identifier) => {
				const originalCard = batchCards.find((card) => {
					// Match the not found identifier back to original card
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

				if (originalCard) {
					results.push({
						originalCard,
						moxfieldRow: convertCardToMoxfieldRow(originalCard, undefined, defaultCondition),
						success: false,
						confidence: 'low',
						identificationMethod: 'failed',
						error: 'Card not found in Scryfall database'
					});
				}
			});

			processedCount += batchCards.length;
			if (progressCallback) {
				progressCallback((processedCount / totalCards) * 100);
			}

			// Rate limiting between batches
			if (i + BATCH_SIZE < cardIdentifierPairs.length) {
				await delay(RATE_LIMIT_DELAY);
			}
		} catch (error) {
			console.error('Error in batch lookup:', error);
			// Add failed results for this batch
			batchCards.forEach((card) => {
				results.push({
					originalCard: card,
					moxfieldRow: convertCardToMoxfieldRow(card, undefined, defaultCondition),
					success: false,
					confidence: 'low',
					identificationMethod: 'failed',
					error: 'API error during lookup'
				});
			});
		}
	}
	return results;
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
		},
		// Convert file to Moxfield format
		convertFile: async (
			file: File,
			format: string,
			progressCallback?: (progress: number) => void,
			defaultCondition?: string
		): Promise<ConversionResult[]> => {
			if (progressCallback) progressCallback(0);

			const content = await file.text();
			const cards = await parseCSVContent(content, format, progressCallback);

			if (progressCallback) progressCallback(80);
			// Convert cards using Scryfall lookup
			const results = await lookupCardsWithScryfall(cards, progressCallback, defaultCondition);

			if (progressCallback) progressCallback(100);

			return results;
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
