import type {
	ConverterEngine,
	CsvFormat,
	ParsedCard,
	ConversionResult,
	ScryfallResponse,
	CardIdentifier,
	ProgressCallback,
	ScryfallCard
} from './types.js';

// Rate limiting for Scryfall API (max 10 requests per second)
const RATE_LIMIT_DELAY = 100; // 100ms between requests
const BATCH_SIZE = 75; // Scryfall collection endpoint limit

// CSV format definitions
const CSV_FORMATS: CsvFormat[] = [
	{
		name: 'Archidekt',
		id: 'archidekt',
		description: 'Archidekt collection export',
		hasHeaders: true,
		columnMappings: {
			count: 'Quantity',
			name: 'Name',
			edition: 'Edition Code',
			condition: 'Condition',
			language: 'Language',
			foil: 'Finish',
			purchasePrice: 'Purchase Price',
			collectorNumber: 'Collector Number',
			scryfallId: 'Scryfall ID',
			multiverseId: 'Multiverse Id'
		},
		transformations: {
			condition: (value: string) => normalizeCondition(value),
			language: (value: string) => normalizeLanguage(value),
			foil: (value: string) => (value.toLowerCase() === 'foil' ? 'foil' : '')
		}
	},
	{
		name: 'CardCastle (Full)',
		id: 'cardcastle-full',
		description: 'CardCastle CSV with Scryfall IDs',
		hasHeaders: true,
		columnMappings: {
			count: '1', // Fixed value since CardCastle doesn't include count
			name: 'Card Name',
			edition: '', // Will need to derive from set name
			condition: 'Condition',
			language: 'Language',
			foil: 'Foil',
			purchasePrice: 'Price USD',
			scryfallId: 'JSON ID',
			multiverseId: 'Multiverse ID'
		},
		transformations: {
			condition: (value: string) => normalizeCondition(value),
			language: (value: string) => normalizeLanguage(value),
			foil: (value: string) => (value.toLowerCase() === 'true' ? 'foil' : '')
		}
	},
	{
		name: 'CardCastle (Simple)',
		id: 'cardcastle-simple',
		description: 'CardCastle Simple CSV',
		hasHeaders: true,
		columnMappings: {
			count: 'Count',
			name: 'Card Name',
			edition: '', // Will need to derive from set name
			collectorNumber: 'Collector Number',
			foil: 'Foil'
		},
		transformations: {
			foil: (value: string) => (value.toLowerCase() === 'true' ? 'foil' : '')
		}
	},
	{
		name: 'DeckBox',
		id: 'deckbox',
		description: 'DeckBox inventory export',
		hasHeaders: true,
		columnMappings: {
			count: 'Count',
			name: 'Name',
			edition: 'Edition Code',
			condition: 'Condition',
			language: 'Language',
			foil: 'Foil',
			collectorNumber: 'Card Number',
			scryfallId: 'Scryfall ID'
		},
		transformations: {
			condition: (value: string) => normalizeCondition(value),
			language: (value: string) => normalizeLanguage(value),
			foil: (value: string) => (value.toLowerCase() === 'true' || value === '1' ? 'foil' : '')
		}
	},
	{
		name: 'DragonShield (App)',
		id: 'dragonshield-app',
		description: 'DragonShield mobile app export',
		hasHeaders: true,
		columnMappings: {
			count: 'Quantity',
			name: 'Name',
			edition: 'Expansion Code',
			condition: 'Condition',
			language: 'Language',
			foil: 'Foil',
			purchasePrice: 'PurchasePrice',
			collectorNumber: 'CardNumber'
		},
		transformations: {
			condition: (value: string) => normalizeDragonShieldCondition(value),
			language: (value: string) => normalizeLanguage(value),
			foil: (value: string) => (value.toLowerCase() === 'true' ? 'foil' : '')
		}
	},
	{
		name: 'DragonShield (Web)',
		id: 'dragonshield-web',
		description: 'DragonShield website export',
		hasHeaders: true,
		columnMappings: {
			count: 'Quantity',
			name: 'Card Name',
			edition: 'Set Code',
			condition: 'Condition',
			language: 'Language',
			foil: 'Printing',
			purchasePrice: 'Price Bought',
			collectorNumber: 'Card Number'
		},
		transformations: {
			condition: (value: string) => normalizeDragonShieldCondition(value),
			language: (value: string) => normalizeLanguage(value),
			foil: (value: string) => (value.toLowerCase() === 'foil' ? 'foil' : '')
		}
	},
	{
		name: 'Moxfield',
		id: 'moxfield',
		description: 'Moxfield collection export (passthrough)',
		hasHeaders: true,
		columnMappings: {
			count: 'Count',
			name: 'Name',
			edition: 'Edition',
			condition: 'Condition',
			language: 'Language',
			foil: 'Foil',
			purchasePrice: 'Purchase Price',
			collectorNumber: 'Collector Number'
		}
	},
	{
		name: 'CubeCobra',
		id: 'cubecobra',
		description: 'CubeCobra cube export',
		hasHeaders: true,
		columnMappings: {
			count: '1', // CubeCobra doesn't include count
			name: 'name',
			edition: 'Set',
			collectorNumber: 'Collector Number',
			foil: 'Finish',
			mtgoId: 'MTGO ID'
		},
		transformations: {
			foil: (value: string) => {
				const normalized = value.toLowerCase();
				return normalized === 'foil' || normalized === 'etched' ? 'foil' : '';
			}
		}
	},
	{
		name: 'TCGPlayer',
		id: 'tcgplayer',
		description: 'TCGPlayer collection export',
		hasHeaders: true,
		columnMappings: {
			count: 'Quantity',
			name: 'Simple Name',
			edition: 'Set Code',
			condition: 'Condition',
			language: 'Language',
			foil: 'Foil',
			collectorNumber: 'Card Number'
		},
		transformations: {
			condition: (value: string) => normalizeCondition(value),
			language: (value: string) => normalizeTCGPlayerLanguage(value),
			foil: (value: string) => (value.toLowerCase() === 'foil' ? 'foil' : '')
		}
	},
	{
		name: 'MTGO (.csv)',
		id: 'mtgo-csv',
		description: 'Magic Online collection CSV export',
		hasHeaders: true,
		columnMappings: {
			count: 'Quantity',
			name: 'Card Name',
			edition: 'Set',
			collectorNumber: 'Collector #',
			foil: 'Premium',
			mtgoId: 'ID #'
		},
		transformations: {
			foil: (value: string) => (value.toLowerCase() === 'yes' ? 'foil' : ''),
			collectorNumber: (value: string) => {
				// MTGO format is like "7/269", extract just the number
				return value.split('/')[0] || value;
			}
		}
	},
	{
		name: 'DelverLens',
		id: 'delverlens',
		description: 'DelverLens collection export',
		hasHeaders: true,
		columnMappings: {
			count: 'Count',
			name: 'Name',
			edition: 'Edition',
			condition: 'Condition',
			language: 'Language',
			foil: 'Foil',
			collectorNumber: 'Collector Number'
		},
		transformations: {
			condition: (value: string) => normalizeCondition(value),
			language: (value: string) => normalizeLanguage(value),
			foil: (value: string) =>
				value.toLowerCase() === 'true' || value.toLowerCase() === 'foil' ? 'foil' : ''
		}
	}
];

function normalizeCondition(condition: string): string {
	const normalized = condition.toLowerCase().replace(/\s+/g, '');
	const conditionMap: Record<string, string> = {
		mint: 'Near Mint',
		nearmint: 'Near Mint',
		nm: 'Near Mint',
		lightlyplayed: 'Lightly Played',
		lightplayed: 'Lightly Played',
		lp: 'Lightly Played',
		excellent: 'Lightly Played', // DragonShield specific
		good: 'Lightly Played', // DragonShield specific
		moderately: 'Moderately Played',
		moderatelyplayed: 'Moderately Played',
		mp: 'Moderately Played',
		played: 'Heavily Played',
		heavilyplayed: 'Heavily Played',
		hp: 'Heavily Played',
		poor: 'Damaged',
		damaged: 'Damaged',
		dmg: 'Damaged'
	};

	return conditionMap[normalized] || condition;
}

function normalizeDragonShieldCondition(condition: string): string {
	const conditionMap: Record<string, string> = {
		Mint: 'Near Mint',
		NearMint: 'Near Mint',
		Excellent: 'Lightly Played',
		LightlyPlayed: 'Lightly Played',
		Good: 'Lightly Played',
		Played: 'Heavily Played',
		Poor: 'Damaged'
	};

	return conditionMap[condition] || condition;
}

function normalizeLanguage(language: string): string {
	const langMap: Record<string, string> = {
		en: 'English',
		english: 'English',
		es: 'Spanish',
		spanish: 'Spanish',
		fr: 'French',
		french: 'French',
		de: 'German',
		german: 'German',
		it: 'Italian',
		italian: 'Italian',
		pt: 'Portuguese',
		portuguese: 'Portuguese',
		jp: 'Japanese',
		japanese: 'Japanese',
		ko: 'Korean',
		korean: 'Korean',
		ru: 'Russian',
		russian: 'Russian',
		zhs: 'Chinese Simplified',
		chinese: 'Chinese Simplified',
		simplifiedchinese: 'Chinese Simplified',
		zht: 'Chinese Traditional',
		ct: 'Chinese Traditional',
		tw: 'Chinese Traditional',
		traditionalchinese: 'Chinese Traditional'
	};

	const normalized = language.toLowerCase().replace(/\s+/g, '');
	return langMap[normalized] || language;
}

function normalizeTCGPlayerLanguage(language: string): string {
	const langMap: Record<string, string> = {
		english: 'English',
		spanish: 'Spanish',
		french: 'French',
		german: 'German',
		italian: 'Italian',
		portuguese: 'Portuguese',
		japanese: 'Japanese',
		korean: 'Korean',
		russian: 'Russian',
		'chinese (traditional)': 'Chinese Traditional',
		'chinese (simplified)': 'Chinese Simplified'
	};

	const normalized = language.toLowerCase();
	return langMap[normalized] || language;
}

async function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchScryfallCollection(identifiers: CardIdentifier[]): Promise<ScryfallResponse> {
	try {
		logDebug(`Making Scryfall API request for ${identifiers.length} cards`);

		const response = await fetch('https://api.scryfall.com/cards/collection', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'OmenPath/1.0',
				Accept: 'application/json'
			},
			body: JSON.stringify({
				identifiers: identifiers.slice(0, BATCH_SIZE)
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			logError(
				`Scryfall API error: ${response.status} ${response.statusText}`,
				new Error(errorText)
			);
			throw new ConversionError(`Scryfall API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		logDebug(`Scryfall API response`, {
			found: data.data?.length || 0,
			notFound: data.not_found?.length || 0
		});

		return data;
	} catch (error) {
		if (error instanceof ConversionError) {
			throw error;
		}

		logError(
			'Network error during Scryfall API request',
			error instanceof Error ? error : new Error(String(error))
		);
		throw new ConversionError(
			'Network error communicating with Scryfall API',
			error instanceof Error ? error : new Error(String(error))
		);
	}
}

function parseCSV(text: string, format: CsvFormat): ParsedCard[] {
	const lines = text.trim().split('\n');
	const delimiter = format.delimiter || ',';

	// Parse headers
	const headers = format.hasHeaders ? parseCSVLine(lines[0], delimiter) : [];
	const dataLines = format.hasHeaders ? lines.slice(1) : lines;

	const cards: ParsedCard[] = [];

	for (const line of dataLines) {
		if (!line.trim()) continue;

		const values = parseCSVLine(line, delimiter);
		const originalData: Record<string, string> = {};

		// Create mapping from headers to values
		if (format.hasHeaders) {
			headers.forEach((header, index) => {
				originalData[header] = values[index] || '';
			});
		} else {
			values.forEach((value, index) => {
				originalData[`column_${index}`] = value;
			});
		}

		// Extract and normalize card data
		const card: ParsedCard = {
			originalData,
			count: parseInt(getColumnValue(originalData, format.columnMappings.count, '1')) || 1,
			name: getColumnValue(originalData, format.columnMappings.name, ''),
			edition: getColumnValue(originalData, format.columnMappings.edition, ''),
			condition: getColumnValue(originalData, format.columnMappings.condition, ''),
			language: getColumnValue(originalData, format.columnMappings.language, ''),
			foil: getColumnValue(originalData, format.columnMappings.foil, ''),
			purchasePrice: getColumnValue(originalData, format.columnMappings.purchasePrice, ''),
			collectorNumber: getColumnValue(originalData, format.columnMappings.collectorNumber, ''),
			scryfallId: getColumnValue(originalData, format.columnMappings.scryfallId, ''),
			needsLookup: true
		}; // Apply transformations
		if (format.transformations) {
			Object.entries(format.transformations).forEach(([key, transform]) => {
				const value = card[key];
				if (typeof value === 'string') {
					card[key] = transform(value);
				}
			});
		}
		// Set needsLookup based on available identifiers
		card.needsLookup = !card.scryfallId && !card.multiverseId && !card.mtgoId;

		// Parse multiverse ID if present
		const multiverseIdStr = getColumnValue(originalData, format.columnMappings.multiverseId, '');
		if (multiverseIdStr) {
			card.multiverseId = parseInt(multiverseIdStr) || undefined;
		}

		cards.push(card);
	}

	return cards;
}

function parseCSVLine(line: string, delimiter: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;
	let i = 0;

	while (i < line.length) {
		const char = line[i];

		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				// Escaped quote
				current += '"';
				i += 2;
			} else {
				// Toggle quote state
				inQuotes = !inQuotes;
				i++;
			}
		} else if (char === delimiter && !inQuotes) {
			// Field separator
			result.push(current.trim());
			current = '';
			i++;
		} else {
			current += char;
			i++;
		}
	}

	result.push(current.trim());
	return result;
}

function getColumnValue(
	data: Record<string, string>,
	mapping: string,
	defaultValue: string
): string {
	if (!mapping) return defaultValue;
	return data[mapping] || defaultValue;
}

function detectFormat(headers: string[]): string | null {
	const headerSet = new Set(headers.map((h) => h.toLowerCase().trim()));

	// Check for exact matches with high confidence
	for (const format of CSV_FORMATS) {
		const requiredColumns = Object.values(format.columnMappings).filter((col) => col);
		const matchingColumns = requiredColumns.filter((col) => headerSet.has(col.toLowerCase()));

		// If we match most required columns, it's likely this format
		if (matchingColumns.length >= Math.min(3, requiredColumns.length * 0.7)) {
			return format.id;
		}
	}

	return null;
}

async function lookupCardsInBatches(
	cards: ParsedCard[],
	progressCallback?: ProgressCallback
): Promise<ConversionResult[]> {
	const results: ConversionResult[] = [];
	const cardsNeedingLookup = cards.filter((card) => card.needsLookup);
	const cardsWithIds = cards.filter((card) => !card.needsLookup);
	// Process cards that already have Scryfall IDs, Multiverse IDs, or MTGO IDs
	for (const card of cardsWithIds) {
		try {
			const identifiers: CardIdentifier[] = [];
			let identificationMethod: ConversionResult['identificationMethod'] = 'failed';
			let confidence: ConversionResult['confidence'] = 'low'; // Priority: Scryfall ID > Multiverse ID > MTGO ID
			if (card.scryfallId) {
				identifiers.push({ id: card.scryfallId });
				identificationMethod = 'scryfall_id';
				confidence = 'high';
			} else if (card.multiverseId) {
				identifiers.push({ multiverse_id: card.multiverseId });
				identificationMethod = 'multiverse_id';
				confidence = 'medium'; // Multiverse IDs may be sunset, so medium confidence
			} else if (card.mtgoId) {
				identifiers.push({ mtgo_id: card.mtgoId });
				identificationMethod = 'mtgo_id';
				confidence = 'high';
			}

			if (identifiers.length > 0) {
				const response = await fetchScryfallCollection(identifiers);
				await delay(RATE_LIMIT_DELAY);

				if (response.data.length > 0) {
					const scryfallCard = response.data[0];
					results.push({
						originalCard: card,
						scryfallCard,
						moxfieldRow: createMoxfieldRow(card, scryfallCard),
						success: true,
						confidence,
						identificationMethod
					});
				} else {
					results.push({
						originalCard: card,
						moxfieldRow: createMoxfieldRow(card),
						success: false,
						error: 'Card not found in Scryfall database',
						confidence: 'low',
						identificationMethod: 'failed'
					});
				}
			} else {
				// This shouldn't happen given our filtering, but handle it just in case
				results.push({
					originalCard: card,
					moxfieldRow: createMoxfieldRow(card),
					success: false,
					error: 'No valid identifiers found',
					confidence: 'low',
					identificationMethod: 'failed'
				});
			}
		} catch (error) {
			results.push({
				originalCard: card,
				moxfieldRow: createMoxfieldRow(card),
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				confidence: 'low',
				identificationMethod: 'failed'
			});
		}
	}

	// Process cards needing lookup in batches with improved hierarchy
	await processCardLookupBatches(cardsNeedingLookup, results, progressCallback);

	return results;
}

async function processCardLookupBatches(
	cardsNeedingLookup: ParsedCard[],
	results: ConversionResult[],
	progressCallback?: ProgressCallback
): Promise<void> {
	// Strategy 1: Try set + collector number first (most precise after IDs)
	const cardsWithSetAndCollector = cardsNeedingLookup.filter(
		(card) => card.edition && card.collectorNumber
	);

	// Strategy 2: Try name + set (less precise)
	const cardsWithNameAndSet = cardsNeedingLookup.filter(
		(card) => !cardsWithSetAndCollector.includes(card) && card.edition
	);

	// Strategy 3: Try name only (least precise)
	const cardsWithNameOnly = cardsNeedingLookup.filter(
		(card) => !cardsWithSetAndCollector.includes(card) && !cardsWithNameAndSet.includes(card)
	);

	let processedCount = 0;
	const totalCount = cardsNeedingLookup.length;
	// Process Strategy 1: Set + Collector Number
	await processBatchWithStrategy(
		cardsWithSetAndCollector,
		'set_collector',
		'high', // Set + collector number should be high confidence
		results,
		(progress) => {
			if (progressCallback) {
				const overallProgress = ((processedCount + progress) / totalCount) * 100;
				progressCallback(overallProgress);
			}
		}
	);
	processedCount += cardsWithSetAndCollector.length;

	// Process Strategy 2: Name + Set
	await processBatchWithStrategy(cardsWithNameAndSet, 'name_set', 'medium', results, (progress) => {
		if (progressCallback) {
			const overallProgress = ((processedCount + progress) / totalCount) * 100;
			progressCallback(overallProgress);
		}
	});
	processedCount += cardsWithNameAndSet.length;

	// Process Strategy 3: Name Only
	await processBatchWithStrategy(cardsWithNameOnly, 'name_only', 'low', results, (progress) => {
		if (progressCallback) {
			const overallProgress = ((processedCount + progress) / totalCount) * 100;
			progressCallback(overallProgress);
		}
	});
}

async function processBatchWithStrategy(
	cards: ParsedCard[],
	identificationMethod: ConversionResult['identificationMethod'],
	confidence: ConversionResult['confidence'],
	results: ConversionResult[],
	progressCallback?: ProgressCallback
): Promise<void> {
	for (let i = 0; i < cards.length; i += BATCH_SIZE) {
		const batch = cards.slice(i, i + BATCH_SIZE);
		const identifiers: CardIdentifier[] = batch.map((card) => {
			const identifier: CardIdentifier = {};

			if (identificationMethod === 'set_collector' && card.edition && card.collectorNumber) {
				identifier.set = card.edition;
				identifier.collector_number = card.collectorNumber;
			} else if (identificationMethod === 'name_set' && card.name && card.edition) {
				identifier.name = card.name;
				identifier.set = card.edition;
			} else if (identificationMethod === 'name_only' && card.name) {
				identifier.name = card.name;
			}

			return identifier;
		});

		try {
			const response = await fetchScryfallCollection(identifiers);
			await delay(RATE_LIMIT_DELAY);

			// Match responses to original cards with enhanced matching logic
			batch.forEach((card) => {
				const scryfallCard = findBestMatch(card, response.data, identificationMethod);

				if (scryfallCard) {
					results.push({
						originalCard: card,
						scryfallCard,
						moxfieldRow: createMoxfieldRow(card, scryfallCard),
						success: true,
						confidence,
						identificationMethod
					});
				} else {
					results.push({
						originalCard: card,
						moxfieldRow: createMoxfieldRow(card),
						success: false,
						error: `Card not found using ${identificationMethod} method`,
						confidence: 'low',
						identificationMethod: 'failed'
					});
				}
			});

			if (progressCallback) {
				const progress = ((i + batch.length) / cards.length) * 100;
				progressCallback(progress);
			}
		} catch (error) {
			// Handle batch errors
			batch.forEach((card) => {
				results.push({
					originalCard: card,
					moxfieldRow: createMoxfieldRow(card),
					success: false,
					error: error instanceof Error ? error.message : 'API error',
					confidence: 'low',
					identificationMethod: 'failed'
				});
			});
		}
	}
}

function findBestMatch(
	card: ParsedCard,
	scryfallCards: ScryfallCard[],
	identificationMethod: ConversionResult['identificationMethod']
): ScryfallCard | undefined {
	if (scryfallCards.length === 0) return undefined;

	// For set + collector number, we expect exact matches
	if (identificationMethod === 'set_collector') {
		return scryfallCards.find(
			(sc) =>
				sc.set.toLowerCase() === card.edition?.toLowerCase() &&
				sc.collector_number === card.collectorNumber
		);
	}

	// For name + set, prioritize exact name and set matches
	if (identificationMethod === 'name_set') {
		const exactMatch = scryfallCards.find(
			(sc) =>
				sc.name.toLowerCase() === card.name.toLowerCase() &&
				sc.set.toLowerCase() === card.edition?.toLowerCase()
		);

		if (exactMatch) return exactMatch;

		// Fallback to name match in the correct set
		return scryfallCards.find(
			(sc) =>
				sc.name.toLowerCase().includes(card.name.toLowerCase()) &&
				sc.set.toLowerCase() === card.edition?.toLowerCase()
		);
	}

	// For name only, find the best name match (prefer newest printing)
	if (identificationMethod === 'name_only') {
		const exactMatch = scryfallCards.find(
			(sc) => sc.name.toLowerCase() === card.name.toLowerCase()
		);

		if (exactMatch) return exactMatch;

		// Fallback to partial name match
		return scryfallCards.find((sc) => sc.name.toLowerCase().includes(card.name.toLowerCase()));
	}

	return scryfallCards[0]; // Default to first result
}
function createMoxfieldRow(card: ParsedCard, scryfallCard?: ScryfallCard): Record<string, string> {
	return {
		Count: card.count.toString(),
		'Tradelist Count': '0',
		Name: scryfallCard?.name || card.name,
		Edition: scryfallCard?.set || card.edition || '',
		Condition: card.condition || 'Near Mint',
		Language: card.language || 'English',
		Foil: card.foil || '',
		Tags: '',
		'Last Modified': new Date().toISOString().replace('T', ' ').replace('Z', ''),
		'Collector Number': scryfallCard?.collector_number || card.collectorNumber || '',
		Alter: 'False',
		Proxy: 'False',
		'Purchase Price': card.purchasePrice || ''
	};
}

export function formatAsMoxfieldCSV(results: ConversionResult[]): string {
	const headers = [
		'Count',
		'Tradelist Count',
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

	results.forEach((result) => {
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
		async convertFile(
			file: File,
			format: string,
			progressCallback?: ProgressCallback
		): Promise<ConversionResult[]> {
			logDebug(`Starting conversion of ${file.name} with format: ${format}`);

			const text = await file.text();

			// Auto-detect format if needed
			let selectedFormat = format;
			if (format === 'auto') {
				const lines = text.trim().split('\n');
				if (lines.length > 0) {
					const headers = parseCSVLine(lines[0], ',');
					selectedFormat = detectFormat(headers) || 'generic';
					logDebug(`Auto-detected format: ${selectedFormat}`, { headers });
				}
			}

			// Find format definition
			const formatDef = CSV_FORMATS.find((f) => f.id === selectedFormat);
			if (!formatDef) {
				const error = new ConversionError(`Unsupported format: ${selectedFormat}`);
				logError('Format not supported', error);
				throw error;
			}

			logDebug(`Using format definition: ${formatDef.name}`);

			// Parse CSV
			const cards = parseCSV(text, formatDef);
			if (cards.length === 0) {
				const error = new ConversionError('No cards found in file');
				logError('No cards parsed from file', error);
				throw error;
			}

			logDebug(`Parsed ${cards.length} cards from CSV`);

			// Convert cards
			try {
				const results = await lookupCardsInBatches(cards, progressCallback);

				const successCount = results.filter((r) => r.success).length;
				const failCount = results.length - successCount;

				logDebug(`Conversion complete: ${successCount} successful, ${failCount} failed`);

				return results;
			} catch (error) {
				const conversionError = new ConversionError(
					'Failed to process cards with Scryfall API',
					error instanceof Error ? error : new Error(String(error))
				);
				logError('Conversion failed', conversionError);
				throw conversionError;
			}
		},
		async parseFile(file: File, format: string): Promise<ParsedCard[]> {
			const text = await file.text();

			// Auto-detect format if needed
			let selectedFormat = format;
			if (format === 'auto') {
				const lines = text.trim().split('\n');
				if (lines.length > 0) {
					const headers = parseCSVLine(lines[0], ',');
					selectedFormat = detectFormat(headers) || 'generic';
				}
			}

			// Find format definition
			const formatDef = CSV_FORMATS.find((f) => f.id === selectedFormat);
			if (!formatDef) {
				throw new ConversionError(`Unsupported format: ${selectedFormat}`);
			}

			// Parse CSV only (no API calls)
			const cards = parseCSV(text, formatDef);
			return cards;
		},

		getSupportedFormats(): CsvFormat[] {
			return CSV_FORMATS;
		},

		detectFormat(headers: string[]): string | null {
			return detectFormat(headers);
		}
	};
}

// Enhanced error handling and logging
class ConversionError extends Error {
	constructor(
		message: string,
		public cause?: Error
	) {
		super(message);
		this.name = 'ConversionError';
	}
}

function logDebug(message: string, data?: unknown) {
	if (typeof window !== 'undefined' && window.console) {
		console.log(`[OmenPath] ${message}`, data || '');
	}
}

function logError(message: string, error?: Error) {
	if (typeof window !== 'undefined' && window.console) {
		console.error(`[OmenPath] ${message}`, error || '');
	}
}
