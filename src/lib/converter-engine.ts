import type {
	ConverterEngine,
	CsvFormat,
	ParsedCard,
	ConversionResult,
	ScryfallResponse,
	CardIdentifier,
	ProgressCallback,
	ScryfallCard,
	ExportOptions,
	ScryfallSet,
	ScryfallSetsResponse
} from './types.js';

// Rate limiting for Scryfall API (max 10 requests per second)
const RATE_LIMIT_DELAY = 100; // 100ms between requests
const BATCH_SIZE = 75; // Scryfall collection endpoint limit

// CSV format definitions
export const CSV_FORMATS: CsvFormat[] = [
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
		description: 'CardCastle CSV with Scryfall IDs (recommended over Simple version for accuracy)',
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
			foil: (value: string) => (value.toLowerCase() === 'true' ? 'foil' : ''),
			scryfallId: (value: string) => {
				// Fix CardCastle bug: remove trailing characters after 36th character for dual-faced cards
				// Scryfall UUIDs are exactly 36 characters (including 4 hyphens)
				if (value && value.length > 36) {
					return value.substring(0, 36);
				}
				return value;
			}
		}
	},
	{
		name: 'CardCastle (Simple)',
		id: 'cardcastle-simple',
		description:
			'CardCastle Simple CSV (⚠️ Use Full version for better accuracy - includes Scryfall IDs)',
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
		name: 'Cardsphere',
		id: 'cardsphere',
		description: 'Cardsphere collection export',
		hasHeaders: true,
		columnMappings: {
			count: 'Count',
			name: 'Name',
			edition: 'Edition',
			condition: 'Condition',
			language: 'Language',
			foil: 'Foil',
			tags: 'Tags',
			scryfallId: 'Scryfall ID',
			lastModified: 'Last Modified',
			tradelistCount: 'Tradelist Count'
		},
		transformations: {
			condition: (value: string) => normalizeCardsphereCondition(value),
			language: (value: string) => normalizeLanguage(value),
			foil: (value: string) => (value.toLowerCase() === 'foil' ? 'foil' : ''),
			edition: (value: string) => value // No special normalization needed for edition
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
		name: 'Decked Builder',
		id: 'decked-builder',
		description: 'Decked Builder collection export (handles regular and foil quantities)',
		hasHeaders: true,
		columnMappings: {
			// Note: This format uses custom processing in parseCSV for quantity handling
			totalQty: 'Total Qty',
			regQty: 'Reg Qty',
			foilQty: 'Foil Qty',
			name: 'Card',
			editionName: 'Set', // Full set name for fuzzy matching like DeckBox
			condition: '', // Not provided in the format
			language: '', // Not provided in the format
			// Note: Mvid is NOT a multiverse ID, it's an internal Decked Builder ID
			purchasePrice: 'Single Price'
		},
		transformations: {
			// No specific transformations needed for this format
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
			editionName: 'Edition', // Full edition name for fuzzy matching
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
		name: 'Generic CSV',
		id: 'generic',
		description: 'Generic CSV format with common column names',
		hasHeaders: true,
		columnMappings: {
			count: 'Count', // Will also try 'Quantity', 'Qty'
			name: 'Name', // Will also try 'Card Name', 'Card'
			edition: 'Edition', // Will also try 'Set', 'Set Code', 'Edition Code'
			condition: 'Condition',
			language: 'Language',
			foil: 'Foil',
			collectorNumber: 'Collector Number', // Will also try 'CN', 'Card Number', 'Number'
			scryfallId: 'Scryfall ID',
			multiverseId: 'Multiverse ID',
			mtgoId: 'MTGO ID'
		},
		transformations: {
			condition: (value: string) => normalizeCondition(value),
			language: (value: string) => normalizeLanguage(value),
			foil: (value: string) =>
				value.toLowerCase() === 'foil' || value.toLowerCase() === 'true' ? 'foil' : ''
		}
	},
	{
		name: 'Helvault',
		id: 'helvault',
		description: 'Helvault collection export with complex tags',
		hasHeaders: true,
		columnMappings: {
			count: 'quantity',
			name: 'name',
			edition: 'set_code',
			language: 'language',
			collectorNumber: 'collector_number',
			purchasePrice: 'estimated_price',
			scryfallId: 'scryfall_id'
			// Note: foil/alter/proxy info is in 'extras' column, handled separately
			// Note: no condition column - will use default condition
		},
		transformations: {
			language: (value: string) => normalizeLanguage(value)
		}
	},
	{
		name: 'ManaBox',
		id: 'manabox',
		description: 'ManaBox mobile app collection export',
		hasHeaders: true,
		columnMappings: {
			count: 'Quantity',
			name: 'Name',
			edition: 'Set code',
			condition: 'Condition',
			language: 'Language',
			foil: 'Foil',
			purchasePrice: 'Purchase price',
			collectorNumber: 'Collector number',
			scryfallId: 'Scryfall ID',
			// Additional ManaBox columns for better detection
			binderName: 'Binder Name',
			binderType: 'Binder Type',
			setName: 'Set name',
			rarity: 'Rarity',
			manaboxId: 'ManaBox ID',
			misprint: 'Misprint',
			altered: 'Altered',
			purchasePriceCurrency: 'Purchase price currency'
		},
		transformations: {
			condition: (value: string) => normalizeManaBoxCondition(value),
			language: (value: string) => normalizeManaBoxLanguage(value),
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
			collectorNumber: 'Collector Number',
			// Additional Moxfield-specific columns
			tradelistCount: 'Tradelist Count',
			tags: 'Tags',
			lastModified: 'Last Modified',
			alter: 'Alter',
			proxy: 'Proxy'
		},
		transformations: {
			condition: (value: string) => normalizeCondition(value),
			language: (value: string) => normalizeLanguage(value),
			foil: (value: string) =>
				value.toLowerCase() === 'foil' || value.toLowerCase() === 'true' ? 'foil' : ''
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
		name: 'Simple Test Format',
		id: 'simple-test',
		description: 'Simple format for testing fuzzy set matching',
		hasHeaders: true,
		columnMappings: {
			count: 'Quantity',
			name: 'Name',
			editionName: 'Set' // Uses editionName to trigger fuzzy matching
		}
	},
	{
		name: 'TappedOut',
		id: 'tappedout',
		description: 'TappedOut inventory export',
		hasHeaders: true,
		columnMappings: {
			count: 'Qty',
			name: 'Name',
			edition: 'Set',
			condition: 'Condition',
			language: 'Languange', // Note: they have a typo in their header
			foil: 'Foil',
			collectorNumber: 'Set Number',
			alter: 'Alter',
			signed: 'Signed',
			proxy: 'Proxy'
		},
		transformations: {
			condition: (value: string) => normalizeTappedOutCondition(value),
			language: (value: string) => normalizeTappedOutLanguage(value),
			foil: (value: string) => (value.toLowerCase() === 'foil' ? 'foil' : ''),
			alter: (value: string) => (value.toLowerCase() === 'true' ? 'true' : ''),
			signed: (value: string) => (value.toLowerCase() === 'true' ? 'true' : ''),
			proxy: (value: string) => (value.toLowerCase() === 'true' ? 'true' : '')
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
			foil: (value: string) => (value.toLowerCase() === 'true' ? 'foil' : '')
		}
	}
];

function normalizeCondition(condition: string): string {
	const normalized = condition
		.toLowerCase()
		.replace(/\s+/g, '')
		.replace(/_/g, '')
		.replace(/-/g, '');
	const conditionMap: Record<string, string> = {
		mint: 'Near Mint',
		nearmint: 'Near Mint',
		nm: 'Near Mint',
		m: 'Near Mint',
		lightlyplayed: 'Lightly Played',
		lightplayed: 'Lightly Played',
		lp: 'Lightly Played',
		excellent: 'Lightly Played', // Common alternate mapping
		good: 'Lightly Played', // Common alternate mapping
		moderately: 'Moderately Played',
		moderatelyplayed: 'Moderately Played',
		mp: 'Moderately Played',
		played: 'Heavily Played', // Default "played" to heavily played
		heavilyplayed: 'Heavily Played',
		hp: 'Heavily Played',
		poor: 'Damaged',
		damaged: 'Damaged',
		dmg: 'Damaged',
		// Additional variations
		fine: 'Lightly Played',
		veryfine: 'Lightly Played',
		veryfinenearmint: 'Near Mint',
		fair: 'Heavily Played'
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

function normalizeManaBoxCondition(condition: string): string {
	const normalized = condition.toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
	const conditionMap: Record<string, string> = {
		mint: 'Near Mint',
		nearmint: 'Near Mint',
		excellent: 'Near Mint', // ManaBox specific - map to Near Mint
		good: 'Lightly Played', // ManaBox specific - map to Lightly Played
		lightplayed: 'Lightly Played',
		lightlyplayed: 'Lightly Played',
		played: 'Moderately Played', // ManaBox "played" is closer to MP
		moderatelyplayed: 'Moderately Played',
		heavilyplayed: 'Heavily Played',
		poor: 'Damaged', // ManaBox specific - map to Damaged
		damaged: 'Damaged'
	};

	return conditionMap[normalized] || 'Near Mint'; // Default to Near Mint if unknown
}

function normalizeTappedOutCondition(condition: string): string {
	if (condition === '-' || !condition) return 'Near Mint';

	const normalized = condition.toLowerCase().replace(/\s+/g, '');
	const conditionMap: Record<string, string> = {
		nm: 'Near Mint',
		nearmint: 'Near Mint',
		mint: 'Near Mint',
		lp: 'Lightly Played',
		lightlyplayed: 'Lightly Played',
		sl: 'Lightly Played', // TappedOut uses "SL" for Slightly Played, map to Lightly Played
		slightlyplayed: 'Lightly Played',
		mp: 'Moderately Played',
		moderatelyplayed: 'Moderately Played',
		hp: 'Heavily Played',
		heavilyplayed: 'Heavily Played',
		dmg: 'Damaged',
		damaged: 'Damaged'
	};

	return conditionMap[normalized] || condition;
}

function normalizeCardsphereCondition(condition: string): string {
	// Cardsphere uses descriptive conditions like "Good (Lightly Played)"
	if (condition.includes('Near Mint')) return 'Near Mint';
	if (condition.includes('Lightly Played')) return 'Lightly Played';
	if (condition.includes('Moderately Played')) return 'Moderately Played';
	if (condition.includes('Heavily Played')) return 'Heavily Played';
	if (condition.includes('Damaged')) return 'Damaged';

	return normalizeCondition(condition);
}

function normalizeManaBoxLanguage(language: string): string {
	const langMap: Record<string, string> = {
		en: 'English',
		es: 'Spanish',
		fr: 'French',
		de: 'German',
		it: 'Italian',
		pt: 'Portuguese',
		ja: 'Japanese',
		ko: 'Korean',
		ru: 'Russian',
		'zh-cn': 'Chinese Simplified',
		'zh-tw': 'Chinese Traditional'
	};

	const normalized = language.toLowerCase();
	return langMap[normalized] || normalizeLanguage(language);
}

function normalizeTappedOutLanguage(language: string): string {
	if (language === '-' || !language) return 'English';

	const langMap: Record<string, string> = {
		en: 'English',
		es: 'Spanish',
		fr: 'French',
		de: 'German',
		it: 'Italian',
		pt: 'Portuguese',
		ja: 'Japanese',
		ko: 'Korean',
		ru: 'Russian'
	};

	const normalized = language.toLowerCase();
	return langMap[normalized] || normalizeLanguage(language);
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

function extractFrontFaceName(cardName: string): string {
	// For double-faced cards, extract the front face name (everything before " // ")
	const doubleFaceSeparator = ' // ';
	if (cardName.includes(doubleFaceSeparator)) {
		return cardName.split(doubleFaceSeparator)[0].trim();
	}
	return cardName;
}

function parseComplexTags(tagsString: string): {
	foil: string;
	alter: string;
	proxy: string;
	notes: string;
} {
	if (!tagsString) {
		return { foil: '', alter: '', proxy: '', notes: '' };
	}

	const tags = tagsString
		.toLowerCase()
		.split('/')
		.map((t) => t.trim());
	const result = { foil: '', alter: '', proxy: '', notes: '' };
	const extraTags: string[] = [];

	for (const tag of tags) {
		if (tag === 'foil') {
			result.foil = 'foil';
		} else if (tag === 'etched') {
			result.foil = 'etched';
		} else if (tag.includes('alter') || tag.includes('art')) {
			result.alter = 'True';
		} else if (tag === 'proxy') {
			result.proxy = 'True';
		} else if (tag === 'signed' || tag.includes('sign')) {
			extraTags.push('signed');
		} else if (tag && tag !== 'none' && tag !== 'normal') {
			extraTags.push(tag);
		}
	}

	if (extraTags.length > 0) {
		result.notes = extraTags.join(', ');
	}

	return result;
}

async function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchScryfallCollection(identifiers: CardIdentifier[]): Promise<ScryfallResponse> {
	try {
		logDebug(`Making Scryfall API request for ${identifiers.length} cards`);

		// Debug log the first few identifiers to check for issues
		if (identifiers.length > 0) {
			logDebug('First few identifiers:', identifiers.slice(0, 3));
		}

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
		} // Extract and normalize card data
		const card: ParsedCard = {
			originalData,
			count: parseInt(getColumnValue(originalData, format.columnMappings.count, '1')) || 1,
			name: getColumnValue(originalData, format.columnMappings.name, ''),
			edition: getColumnValue(originalData, format.columnMappings.edition, ''),
			editionName: getColumnValue(originalData, format.columnMappings.editionName, ''),
			condition: getColumnValue(originalData, format.columnMappings.condition, ''),
			language: getColumnValue(originalData, format.columnMappings.language, ''),
			foil: getColumnValue(originalData, format.columnMappings.foil, ''),
			purchasePrice: getColumnValue(originalData, format.columnMappings.purchasePrice, ''),
			collectorNumber: getColumnValue(originalData, format.columnMappings.collectorNumber, ''),
			scryfallId: getColumnValue(originalData, format.columnMappings.scryfallId, ''),
			// Additional fields
			tradelistCount: getColumnValue(originalData, format.columnMappings.tradelistCount, ''),
			lastModified: getColumnValue(originalData, format.columnMappings.lastModified, ''),
			alter: getColumnValue(originalData, format.columnMappings.alter, ''),
			proxy: getColumnValue(originalData, format.columnMappings.proxy, ''),
			tags: getColumnValue(originalData, format.columnMappings.tags, ''),
			needsLookup: true
		};

		// Handle complex tags (like Helvault's "extras" column: "foil/alteredArt/proxy")
		const extrasColumn = getColumnValue(originalData, 'extras', '');
		if (extrasColumn) {
			const complexTags = parseComplexTags(extrasColumn);
			if (complexTags.foil && !card.foil) card.foil = complexTags.foil;
			if (complexTags.alter && !card.alter) card.alter = complexTags.alter;
			if (complexTags.proxy && !card.proxy) card.proxy = complexTags.proxy;
			if (complexTags.notes) card.notes = complexTags.notes;
		}

		// Apply transformations
		if (format.transformations) {
			Object.entries(format.transformations).forEach(([key, transform]) => {
				const value = card[key];
				if (typeof value === 'string') {
					card[key] = transform(value);
				}
			});
		}

		// Parse multiverse ID if present (do this early so it's available for all cards)
		// Skip for Decked Builder since Mvid is not a real multiverse ID
		if (format.id !== 'decked-builder') {
			const multiverseIdStr = getColumnValue(originalData, format.columnMappings.multiverseId, '');
			if (multiverseIdStr) {
				card.multiverseId = parseInt(multiverseIdStr) || undefined;
			}
		}

		// Special handling for Cardsphere etched foils
		if (format.id === 'cardsphere') {
			// Check if the original edition had "Etched Foil" suffix
			const originalEdition = getColumnValue(originalData, format.columnMappings.edition, '');
			if (originalEdition.endsWith(' Etched Foil') && card.foil === 'foil') {
				// This is an etched foil card
				card.foil = 'etched';
			}
		}

		// Special handling for Decked Builder quantity splitting
		if (format.id === 'decked-builder') {
			const regQtyStr = getColumnValue(originalData, format.columnMappings.regQty, '0');
			const foilQtyStr = getColumnValue(originalData, format.columnMappings.foilQty, '0');
			const regQty = parseInt(regQtyStr) || 0;
			const foilQty = parseInt(foilQtyStr) || 0;

			// Skip this card if no quantities
			if (regQty === 0 && foilQty === 0) {
				continue;
			}

			// Create separate entries for regular and foil copies
			if (regQty > 0) {
				const regularCard = { ...card };
				regularCard.count = regQty;
				regularCard.foil = '';
				regularCard.needsLookup =
					!regularCard.scryfallId && !regularCard.multiverseId && !regularCard.mtgoId;
				cards.push(regularCard);
			}

			if (foilQty > 0) {
				const foilCard = { ...card };
				foilCard.count = foilQty;
				foilCard.foil = 'foil';
				foilCard.needsLookup = !foilCard.scryfallId && !foilCard.multiverseId && !foilCard.mtgoId;
				cards.push(foilCard);
			}

			// Skip the normal card.push() at the end since we've already added our cards
			continue;
		}

		// Set needsLookup based on available identifiers
		card.needsLookup = !card.scryfallId && !card.multiverseId && !card.mtgoId;

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

	// First try exact match
	if (data[mapping]) return data[mapping];

	// Try case-insensitive match
	const lowerMapping = mapping.toLowerCase();
	for (const [key, value] of Object.entries(data)) {
		if (key.toLowerCase() === lowerMapping) {
			return value;
		}
	}

	// Try fuzzy matching for common variations
	const fuzzyMatches: Record<string, string[]> = {
		name: ['card name', 'card', 'title'],
		count: ['quantity', 'qty', 'amount'],
		edition: ['set', 'set code', 'edition code', 'expansion'],
		'collector number': ['cn', 'card number', 'number', 'collector_number', 'collector-number'],
		foil: ['finish', 'treatment', 'premium'],
		condition: ['cond', 'grade'],
		language: ['lang', 'locale']
	};

	const alternatives = fuzzyMatches[lowerMapping] || [];
	for (const alt of alternatives) {
		for (const [key, value] of Object.entries(data)) {
			if (key.toLowerCase() === alt.toLowerCase()) {
				return value;
			}
		}
	}

	return defaultValue;
}

function detectFormat(headers: string[]): string | null {
	const headerSet = new Set(headers.map((h) => h.toLowerCase().trim()));
	logDebug(`Detecting format from headers:`, Array.from(headerSet));
	// Calculate a sophisticated score for each format
	interface FormatScore {
		format: CsvFormat;
		score: number;
		details: {
			formatId: string;
			formatName: string;
			totalColumns: number;
			matchedColumns: number;
			baseScore: number;
			bonuses: string[];
			penalties: string[];
			finalScore: number;
		};
	}

	const formatScores: FormatScore[] = [];

	for (const format of CSV_FORMATS) {
		const requiredColumns = Object.values(format.columnMappings).filter((col) => col);
		const matchingColumns = requiredColumns.filter((col) => headerSet.has(col.toLowerCase()));

		// Base score: percentage of columns matched
		let score = matchingColumns.length / requiredColumns.length;
		// Scoring details for debugging
		const details = {
			formatId: format.id,
			formatName: format.name,
			totalColumns: requiredColumns.length,
			matchedColumns: matchingColumns.length,
			baseScore: score,
			bonuses: [] as string[],
			penalties: [] as string[],
			finalScore: 0
		};

		// BONUS: Format-specific unique identifiers (high weight)
		const uniqueIdentifiers = getUniqueIdentifiers(format.id);
		const uniqueMatches = uniqueIdentifiers.filter((col) => headerSet.has(col.toLowerCase()));
		if (uniqueMatches.length > 0) {
			const uniqueBonus = uniqueMatches.length * 0.5; // Big bonus for unique columns
			score += uniqueBonus;
			details.bonuses.push(`Unique identifiers (${uniqueMatches.join(', ')}): +${uniqueBonus}`);
		}

		// BONUS: Exact column name matches vs fuzzy matches
		const exactMatches = matchingColumns.filter(
			(col) => headers.some((h) => h === col) // Exact case-sensitive match
		);
		if (exactMatches.length > 0) {
			const exactBonus = exactMatches.length * 0.1;
			score += exactBonus;
			details.bonuses.push(`Exact case matches (${exactMatches.length}): +${exactBonus}`);
		}

		// BONUS: High-value identification columns (Scryfall ID, Multiverse ID, etc.)
		const highValueColumns = ['scryfall id', 'multiverse id', 'mtgo id', 'json id'];
		const highValueMatches = highValueColumns.filter((col) => headerSet.has(col));
		if (highValueMatches.length > 0) {
			const idBonus = highValueMatches.length * 0.3;
			score += idBonus;
			details.bonuses.push(`High-value ID columns (${highValueMatches.join(', ')}): +${idBonus}`);
		}

		// PENALTY: Too many unmatched headers (suggests wrong format)
		const unmatchedHeaders = headers.length - matchingColumns.length;
		if (unmatchedHeaders > 5) {
			const penalty = Math.min(0.3, (unmatchedHeaders - 5) * 0.05);
			score -= penalty;
			details.penalties.push(`Too many unmatched headers (${unmatchedHeaders}): -${penalty}`);
		}

		details.finalScore = score;
		formatScores.push({ format, score, details });
	}

	// Sort by score descending
	formatScores.sort((a, b) => b.score - a.score);

	// Log detailed scoring for debugging
	logDebug(
		`Format detection scores:`,
		formatScores.map((fs) => ({
			format: fs.format.name,
			score: fs.score.toFixed(3),
			details: fs.details
		}))
	);

	// Choose the best format if it meets minimum criteria
	const bestMatch = formatScores[0];
	const secondBest = formatScores[1];

	// Require minimum score and clear winner
	if (bestMatch.score >= 0.6 && (!secondBest || bestMatch.score > secondBest.score + 0.2)) {
		logDebug(
			`Selected format: ${bestMatch.format.name} (${bestMatch.format.id}) with score ${bestMatch.score.toFixed(3)}`
		);
		return bestMatch.format.id;
	}

	logDebug(
		`No clear format winner, falling back to generic. Best was ${bestMatch.format.name} with score ${bestMatch.score.toFixed(3)}`
	);
	return null;
}

// Define unique identifiers for each format to improve detection accuracy
function getUniqueIdentifiers(formatId: string): string[] {
	const uniqueIdentifiers: Record<string, string[]> = {
		manabox: ['manabox id', 'binder name', 'binder type'],
		moxfield: ['tradelist count', 'last modified', 'alter', 'proxy'],
		archidekt: ['finish', 'date added', 'edition name'],
		deckbox: [
			'tradelist count',
			'decks count built',
			'decks count all',
			'printing id',
			'tcgplayer id'
		],
		delver: [], // DelverLens is pretty generic
		tcgplayer: ['tcgplayer id', 'category', 'number'],
		'decked-builder': ['total qty', 'reg qty', 'foil qty', 'single price', 'single foil price'],
		cardsphere: ['have', 'want'],
		mtgo: ['premium', 'trade restriction'],
		tappedout: ['languange'], // Note: TappedOut has a typo in their header
		cubecobraa: ['cube name', 'cube id'],
		cubecobrab: ['cube', 'board'],
		helvault: ['extras'], // Helvault has a complex "extras" column
		dragonshieldapp: ['folder id'],
		dragonshieldweb: ['dragon shield'],
		deckstats: ['deck id'],
		deckedbuilder: ['playable'],
		urzasgatherer: ['quantity owned']
	};

	return uniqueIdentifiers[formatId] || [];
}

async function lookupCardsInBatches(
	cards: ParsedCard[],
	progressCallback?: ProgressCallback,
	defaultCondition?: string,
	exportOptions?: ExportOptions
): Promise<ConversionResult[]> {
	const results: ConversionResult[] = [];
	const cardsNeedingLookup = cards.filter((card) => card.needsLookup);
	const cardsWithIds = cards.filter((card) => !card.needsLookup);

	// Process cards that already have Scryfall IDs, Multiverse IDs, or MTGO IDs using batching
	if (cardsWithIds.length > 0) {
		await processCardsWithIds(
			cardsWithIds,
			results,
			defaultCondition,
			exportOptions,
			(progress) => {
				if (progressCallback) {
					// Use 50% of progress for ID cards
					const idCardProgress = progress * 0.5;
					progressCallback(Math.min(50, idCardProgress));
				}
			}
		);
	}
	// Process cards needing lookup in batches with improved hierarchy
	await processCardLookupBatches(
		cardsNeedingLookup,
		results,
		defaultCondition,
		exportOptions,
		(progress) => {
			if (progressCallback) {
				// Allocate 50% progress to ID cards, 50% to lookup cards
				const adjustedProgress = 50 + progress * 0.5;
				progressCallback(Math.min(100, adjustedProgress));
			}
		}
	);

	return results;
}

async function processCardLookupBatches(
	cardsNeedingLookup: ParsedCard[],
	results: ConversionResult[],
	defaultCondition?: string,
	exportOptions?: ExportOptions,
	progressCallback?: ProgressCallback
): Promise<void> {
	let remainingCards = [...cardsNeedingLookup];
	const totalCount = cardsNeedingLookup.length;
	let processedCount = 0;

	// Strategy 1: Try set + collector number first (most precise after IDs)
	const cardsWithSetAndCollector = remainingCards.filter(
		(card) => card.edition && card.collectorNumber
	);

	if (cardsWithSetAndCollector.length > 0) {
		const strategyResults: ConversionResult[] = [];
		await processBatchWithStrategy(
			cardsWithSetAndCollector,
			'set_collector',
			'high',
			strategyResults,
			defaultCondition,
			exportOptions,
			(batchProgress) => {
				if (progressCallback) {
					const overallProgress =
						((processedCount + (batchProgress * cardsWithSetAndCollector.length) / 100) /
							totalCount) *
						100;
					progressCallback(Math.min(100, overallProgress));
				}
			}
		);
		// Add successful results and remove successful cards from remaining
		strategyResults.forEach((result) => {
			if (result.success) {
				results.push(result);
				remainingCards = remainingCards.filter((card) => card !== result.originalCard);
			}
			// Don't add failed results yet - they'll be tried in the next strategy
		});
		processedCount += cardsWithSetAndCollector.length;
	}
	// Strategy 2: Try name + set for remaining cards
	const cardsWithNameAndSet = remainingCards.filter((card) => card.edition);

	console.log(`Strategy 2: Processing ${cardsWithNameAndSet.length} cards with name + set`);

	if (cardsWithNameAndSet.length > 0) {
		const strategyResults: ConversionResult[] = [];
		await processBatchWithStrategy(
			cardsWithNameAndSet,
			'name_set',
			'medium',
			strategyResults,
			defaultCondition,
			exportOptions,
			(batchProgress) => {
				if (progressCallback) {
					const overallProgress =
						((processedCount + (batchProgress * cardsWithNameAndSet.length) / 100) / totalCount) *
						100;
					progressCallback(Math.min(100, overallProgress));
				}
			}
		);
		// Add successful results and remove successful cards from remaining
		strategyResults.forEach((result) => {
			if (result.success) {
				results.push(result);
				remainingCards = remainingCards.filter((card) => card !== result.originalCard);
			}
			// Don't add failed results yet - they'll be tried in the next strategy
		});
		processedCount += cardsWithNameAndSet.length;

		console.log(
			`Strategy 2 completed: ${strategyResults.filter((r) => r.success).length} successful, ${remainingCards.length} remaining`
		);
	}

	// Strategy 3: Try fuzzy set matching for remaining cards with edition names
	const cardsWithFuzzySet = remainingCards.filter((card) => card.editionName);

	console.log(`Strategy 3: Processing ${cardsWithFuzzySet.length} cards with fuzzy set matching`);
	cardsWithFuzzySet.forEach((card) => {
		console.log(`  - Card: ${card.name}, Edition: ${card.editionName}`);
	});

	if (cardsWithFuzzySet.length > 0) {
		const strategyResults: ConversionResult[] = [];
		await processFuzzySetStrategy(
			cardsWithFuzzySet,
			'fuzzy_set',
			'medium',
			strategyResults,
			defaultCondition,
			exportOptions,
			(batchProgress) => {
				if (progressCallback) {
					const overallProgress =
						((processedCount + (batchProgress * cardsWithFuzzySet.length) / 100) / totalCount) *
						100;
					progressCallback(Math.min(100, overallProgress));
				}
			}
		);
		// Add successful results and remove successful cards from remaining
		strategyResults.forEach((result) => {
			if (result.success) {
				results.push(result);
				remainingCards = remainingCards.filter((card) => card !== result.originalCard);
			}
			// Don't add failed results yet - they'll be tried in the next strategy
		});
		processedCount += cardsWithFuzzySet.length;
	}

	// Strategy 4: Try name only for any remaining cards
	if (remainingCards.length > 0) {
		await processBatchWithStrategy(
			remainingCards,
			'name_only',
			'low',
			results,
			defaultCondition,
			exportOptions,
			(batchProgress) => {
				if (progressCallback) {
					const overallProgress =
						((processedCount + (batchProgress * remainingCards.length) / 100) / totalCount) * 100;
					progressCallback(Math.min(100, overallProgress));
				}
			}
		);
	}
}

async function processBatchWithStrategy(
	cards: ParsedCard[],
	identificationMethod: ConversionResult['identificationMethod'],
	confidence: ConversionResult['confidence'],
	results: ConversionResult[],
	defaultCondition?: string,
	exportOptions?: ExportOptions,
	progressCallback?: ProgressCallback
): Promise<void> {
	for (let i = 0; i < cards.length; i += BATCH_SIZE) {
		const batch = cards.slice(i, i + BATCH_SIZE);
		const identifiers: CardIdentifier[] = batch
			.map((card) => {
				const identifier: CardIdentifier = {};
				if (identificationMethod === 'set_collector' && card.edition && card.collectorNumber) {
					identifier.set = card.edition.toLowerCase(); // Scryfall expects lowercase set codes
					identifier.collector_number = card.collectorNumber;
				} else if (identificationMethod === 'name_set' && card.name && card.edition) {
					identifier.name = card.name;
					identifier.set = card.edition.toLowerCase(); // Scryfall expects lowercase set codes
				} else if (identificationMethod === 'name_only' && card.name) {
					// For name-only searches, use just the front face name for double-faced cards
					identifier.name = extractFrontFaceName(card.name);
				}

				return identifier;
			})
			.filter((identifier) => Object.keys(identifier).length > 0); // Filter out empty identifiers
		if (identifiers.length === 0) {
			// Skip this batch if no valid identifiers
			batch.forEach((card) => {
				results.push({
					originalCard: card,
					moxfieldRow: createMoxfieldRow(card, undefined, defaultCondition),
					success: false,
					error: 'No valid identifiers for Scryfall lookup',
					confidence: 'low',
					identificationMethod: 'failed'
				});
			});

			if (progressCallback) {
				const progress = ((i + batch.length) / cards.length) * 100;
				progressCallback(Math.min(100, progress));
			}
			continue;
		}

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
						moxfieldRow: createMoxfieldRow(card, scryfallCard, defaultCondition),
						success: true,
						confidence,
						identificationMethod
					});
				} else {
					// More specific error messages based on identification method
					let errorMessage = `Card not found using ${identificationMethod} method`;
					if (identificationMethod === 'set_collector') {
						errorMessage = `Card not found with set "${card.edition}" and collector number "${card.collectorNumber}"`;
					} else if (identificationMethod === 'name_set') {
						errorMessage = `Card "${card.name}" not found in set "${card.edition}"`;
					} else if (identificationMethod === 'name_only') {
						errorMessage = `Card "${card.name}" not found in Scryfall database`;
					}
					results.push({
						originalCard: card,
						moxfieldRow: createMoxfieldRow(card, undefined, defaultCondition),
						success: false,
						error: errorMessage,
						confidence: 'low',
						identificationMethod: 'failed'
					});
				}
			});
		} catch (error) {
			// Handle batch errors
			batch.forEach((card) => {
				results.push({
					originalCard: card,
					moxfieldRow: createMoxfieldRow(card, undefined, defaultCondition),
					success: false,
					error: error instanceof Error ? error.message : 'API error',
					confidence: 'low',
					identificationMethod: 'failed'
				});
			});
		}

		// Report progress for this batch
		if (progressCallback) {
			const progress = ((i + batch.length) / cards.length) * 100;
			progressCallback(Math.min(100, progress));
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
function createMoxfieldRow(
	card: ParsedCard,
	scryfallCard?: ScryfallCard,
	defaultCondition?: string
): Record<string, string> {
	const row: Record<string, string> = {
		Count: card.count.toString(),
		'Tradelist Count': card.tradelistCount || '0',
		Name: scryfallCard?.name || card.name,
		Edition: scryfallCard?.set || card.edition || '',
		Condition: card.condition || defaultCondition || 'Near Mint',
		Language: card.language || 'English',
		Foil: card.foil || '',
		Tags: card.tags || '',
		'Last Modified': card.lastModified || '',
		'Collector Number': scryfallCard?.collector_number || card.collectorNumber || '',
		Alter: card.alter || 'False',
		Proxy: card.proxy || 'False',
		Signed: card.signed || 'False',
		'Purchase Price': card.purchasePrice || ''
	}; // Always populate additional fields when Scryfall data is available
	// This allows users to toggle export options after conversion
	if (scryfallCard) {
		// Current prices for all currencies
		row['Current Price USD'] = scryfallCard.prices.usd || '';
		row['Current Price USD Foil'] = scryfallCard.prices.usd_foil || '';
		row['Current Price USD Etched'] = scryfallCard.prices.usd_etched || '';
		row['Current Price EUR'] = scryfallCard.prices.eur || '';
		row['Current Price EUR Foil'] = scryfallCard.prices.eur_foil || '';
		row['Current Price TIX'] = scryfallCard.prices.tix || '';

		// Card IDs
		row['MTGO ID'] = scryfallCard.mtgo_id?.toString() || '';
		row['MTGO Foil ID'] = scryfallCard.mtgo_foil_id?.toString() || '';
		row['Multiverse ID'] = scryfallCard.multiverse_ids?.[0]?.toString() || '';
		row['TCGPlayer ID'] = scryfallCard.tcgplayer_id?.toString() || '';
		row['CardMarket ID'] = scryfallCard.cardmarket_id?.toString() || '';

		// Set the display price for the main "Current Price" field
		// Always determine the appropriate price based on card finish
		let priceKey: keyof ScryfallCard['prices'] = 'usd'; // Default to USD

		// Adjust price key based on card finish
		if (card.foil === 'foil') {
			priceKey = 'usd_foil';
		} else if (card.foil === 'etched') {
			priceKey = 'usd_etched';
		}

		const price = scryfallCard.prices[priceKey];
		row['Current Price'] = price || '';
	}

	// Add Notes column if there are extra notes that don't fit elsewhere
	if (card.notes) {
		row.Notes = card.notes;
	}

	return row;
}

export function formatAsMoxfieldCSV(
	results: ConversionResult[],
	exportOptions?: ExportOptions
): string {
	const baseHeaders = [
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
		'Signed',
		'Purchase Price'
	];

	// Add optional headers based on export options
	const additionalHeaders: string[] = [];
	if (exportOptions?.includeCurrentPrice) additionalHeaders.push('Current Price');
	if (exportOptions?.includeMtgoIds) additionalHeaders.push('MTGO ID', 'MTGO Foil ID');
	if (exportOptions?.includeMultiverseId) additionalHeaders.push('Multiverse ID');
	if (exportOptions?.includeTcgPlayerId) additionalHeaders.push('TCGPlayer ID');
	if (exportOptions?.includeCardMarketId) additionalHeaders.push('CardMarket ID');

	const headers = [...baseHeaders, ...additionalHeaders, 'Notes'];
	const csvLines = [headers.map((h) => `"${h}"`).join(',')];

	// Sort results: low confidence first, then by name alphabetically
	const sortedResults = [...results].sort((a, b) => {
		// First sort by confidence (low confidence first)
		const confidenceOrder = { low: 0, medium: 1, high: 2 };
		const aConfidence = confidenceOrder[a.confidence] ?? 2;
		const bConfidence = confidenceOrder[b.confidence] ?? 2;

		if (aConfidence !== bConfidence) {
			return aConfidence - bConfidence;
		}

		// Then sort alphabetically by name
		const aName = a.moxfieldRow.Name || '';
		const bName = b.moxfieldRow.Name || '';
		return aName.localeCompare(bName);
	});

	sortedResults.forEach((result) => {
		const row = headers.map((header) => {
			let value = result.moxfieldRow[header] || '';

			// Add confidence info to Notes for low confidence cards
			if (header === 'Notes' && result.confidence === 'low') {
				const existingNotes = value ? `${value}; ` : '';
				value = `${existingNotes}⚠️ Low confidence - please verify`;
			}

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
			progressCallback?: ProgressCallback,
			defaultCondition?: string,
			exportOptions?: ExportOptions
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

			// Consolidate identical cards to avoid duplicate entries
			const consolidatedCards = consolidateIdenticalCards(cards);
			if (consolidatedCards.length !== cards.length) {
				logDebug(
					`Consolidated ${cards.length} cards into ${consolidatedCards.length} unique entries`
				);
			}

			// Convert cards
			try {
				const results = await lookupCardsInBatches(
					consolidatedCards,
					progressCallback,
					defaultCondition,
					exportOptions
				);

				// Consolidate identical results after Scryfall lookup
				const consolidatedResults = consolidateIdenticalResults(results);
				if (consolidatedResults.length !== results.length) {
					logDebug(
						`Consolidated ${results.length} results into ${consolidatedResults.length} unique entries after Scryfall lookup`
					);
				}

				const successCount = consolidatedResults.filter((r) => r.success).length;
				const failCount = consolidatedResults.length - successCount;

				logDebug(`Conversion complete: ${successCount} successful, ${failCount} failed`);

				return consolidatedResults;
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

async function processCardsWithIds(
	cardsWithIds: ParsedCard[],
	results: ConversionResult[],
	defaultCondition?: string,
	exportOptions?: ExportOptions,
	progressCallback?: ProgressCallback
): Promise<void> {
	logDebug(
		`Processing ${cardsWithIds.length} cards with IDs using batching (batch size: ${BATCH_SIZE})`
	);
	// Process cards with IDs in batches for efficiency
	for (let i = 0; i < cardsWithIds.length; i += BATCH_SIZE) {
		const batch = cardsWithIds.slice(i, i + BATCH_SIZE);

		logDebug(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} with ${batch.length} cards`);
		// Build identifiers for this batch
		const uniqueIdentifiers = new Map<string, CardIdentifier>();
		const cardsByIdentifier = new Map<
			string,
			Array<{
				card: ParsedCard;
				method: ConversionResult['identificationMethod'];
				confidence: ConversionResult['confidence'];
			}>
		>();

		batch.forEach((card) => {
			let identifier: CardIdentifier = {};
			let identificationMethod: ConversionResult['identificationMethod'] = 'failed';
			let confidence: ConversionResult['confidence'] = 'low';
			let key: string = ''; // Priority: Scryfall ID > Multiverse ID > MTGO ID
			if (card.scryfallId) {
				// Debug logging for CardCastle dual-faced card fix
				if (card.scryfallId.length > 36) {
					logDebug(
						`CardCastle fix: Trimming Scryfall ID "${card.scryfallId}" to "${card.scryfallId.substring(0, 36)}" for card: ${card.name}`
					);
				}
				identifier = { id: card.scryfallId };
				identificationMethod = 'scryfall_id';
				confidence = 'high';
				key = `id:${card.scryfallId}`;
			} else if (card.multiverseId) {
				identifier = { multiverse_id: card.multiverseId };
				identificationMethod = 'multiverse_id';
				confidence = 'medium'; // Multiverse IDs may be sunset, so medium confidence
				key = `multiverse_id:${card.multiverseId}`;
			} else if (card.mtgoId) {
				identifier = { mtgo_id: card.mtgoId };
				identificationMethod = 'mtgo_id';
				confidence = 'high';
				key = `mtgo_id:${card.mtgoId}`;
			}

			if (Object.keys(identifier).length > 0) {
				// Store unique identifier for API call
				if (!uniqueIdentifiers.has(key)) {
					uniqueIdentifiers.set(key, identifier);
				}

				// Group all cards by their identifier key
				if (!cardsByIdentifier.has(key)) {
					cardsByIdentifier.set(key, []);
				}
				cardsByIdentifier.get(key)!.push({ card, method: identificationMethod, confidence });
			} else {
				// Handle cards without valid identifiers
				results.push({
					originalCard: card,
					moxfieldRow: createMoxfieldRow(card, undefined, defaultCondition),
					success: false,
					error: 'No valid identifiers found',
					confidence: 'low',
					identificationMethod: 'failed'
				});
			}
		});

		const identifiers = Array.from(uniqueIdentifiers.values());

		if (identifiers.length === 0) {
			// Update progress and continue if no valid identifiers in this batch
			if (progressCallback) {
				const progress = ((i + batch.length) / cardsWithIds.length) * 100;
				progressCallback(Math.min(100, progress));
			}
			continue;
		}

		try {
			const response = await fetchScryfallCollection(identifiers);
			await delay(RATE_LIMIT_DELAY); // Create a map of found cards by their identifiers
			const foundCards = new Map<string, ScryfallCard>();
			response.data.forEach((scryfallCard: ScryfallCard) => {
				// Create keys for all possible identifier types this card might match
				if (scryfallCard.id) {
					foundCards.set(`id:${scryfallCard.id}`, scryfallCard);
				}
				if (scryfallCard.multiverse_ids) {
					scryfallCard.multiverse_ids.forEach((id: number) => {
						foundCards.set(`multiverse_id:${id}`, scryfallCard);
					});
				}
				if (scryfallCard.mtgo_id) {
					foundCards.set(`mtgo_id:${scryfallCard.mtgo_id}`, scryfallCard);
				}
				if (scryfallCard.mtgo_foil_id) {
					foundCards.set(`mtgo_id:${scryfallCard.mtgo_foil_id}`, scryfallCard);
				}
			});

			// Match results back to original cards
			cardsByIdentifier.forEach((cardInfos, key) => {
				const scryfallCard = foundCards.get(key);

				// Process each card that had this identifier
				cardInfos.forEach(({ card, method, confidence }) => {
					if (scryfallCard) {
						results.push({
							originalCard: card,
							scryfallCard,
							moxfieldRow: createMoxfieldRow(card, scryfallCard, defaultCondition),
							success: true,
							confidence,
							identificationMethod: method
						});
					} else {
						results.push({
							originalCard: card,
							moxfieldRow: createMoxfieldRow(card, undefined, defaultCondition),
							success: false,
							error: 'Card not found in Scryfall database',
							confidence: 'low',
							identificationMethod: 'failed'
						});
					}
				});
			});
		} catch (error) {
			// Handle batch errors - mark all cards in batch as failed
			cardsByIdentifier.forEach((cardInfos) => {
				cardInfos.forEach(({ card }) => {
					results.push({
						originalCard: card,
						moxfieldRow: createMoxfieldRow(card, undefined, defaultCondition),
						success: false,
						error: error instanceof Error ? error.message : 'API error',
						confidence: 'low',
						identificationMethod: 'failed'
					});
				});
			});
		}

		// Report progress for this batch
		if (progressCallback) {
			const progress = ((i + batch.length) / cardsWithIds.length) * 100;
			progressCallback(Math.min(100, progress));
		}
	}
}

/**
 * Fetches all Scryfall sets for fuzzy matching
 */
async function fetchScryfallSets(): Promise<ScryfallSet[]> {
	try {
		const response = await fetch('https://api.scryfall.com/sets');
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
		const data: ScryfallSetsResponse = await response.json();
		logDebug(`Fetched ${data.data.length} Scryfall sets for fuzzy matching`);
		return data.data;
	} catch (error) {
		logError(
			'Failed to fetch Scryfall sets for fuzzy matching',
			error instanceof Error ? error : new Error(String(error))
		);
		throw new ConversionError('Failed to fetch Scryfall sets for fuzzy matching');
	}
}

/**
 * Fuzzy matches a set name to a Scryfall set code
 */
function fuzzyMatchSetName(setName: string, scryfallSets: ScryfallSet[]): string | null {
	const normalizedInput = setName.toLowerCase().trim();

	// Try exact name match first
	for (const set of scryfallSets) {
		if (set.name.toLowerCase() === normalizedInput) {
			logDebug(`Found exact set match: ${setName} -> ${set.code}`);
			return set.code;
		}
	}

	// Try exact code match
	for (const set of scryfallSets) {
		if (set.code.toLowerCase() === normalizedInput) {
			logDebug(`Found exact code match: ${setName} -> ${set.code}`);
			return set.code;
		}
	}

	// Try partial name matching
	for (const set of scryfallSets) {
		if (
			set.name.toLowerCase().includes(normalizedInput) ||
			normalizedInput.includes(set.name.toLowerCase())
		) {
			logDebug(`Found fuzzy set match: ${setName} -> ${set.code} (${set.name})`);
			return set.code;
		}
	}

	// Try common set name mappings
	const commonMappings: Record<string, string> = {
		alpha: 'lea',
		beta: 'leb',
		unlimited: 'c2ed',
		revised: '3ed',
		'fourth edition': '4ed',
		'fifth edition': '5ed',
		'classic sixth edition': '6ed',
		'seventh edition': '7ed',
		'eighth edition': '8ed',
		'ninth edition': '9ed',
		'tenth edition': '10e',
		'magic 2010': 'm10',
		'magic 2011': 'm11',
		'magic 2012': 'm12',
		'magic 2013': 'm13',
		'magic 2014': 'm14',
		'magic 2015': 'm15',
		'magic origins': 'ori'
	};

	const mappedCode = commonMappings[normalizedInput];
	if (mappedCode) {
		logDebug(`Found mapped set: ${setName} -> ${mappedCode}`);
		return mappedCode;
	}

	logDebug(`No fuzzy match found for set: ${setName}`);
	return null;
}

/**
 * Processes cards using fuzzy set matching strategy with proper batching
 */
async function processFuzzySetStrategy(
	cards: ParsedCard[],
	identificationMethod: ConversionResult['identificationMethod'],
	confidence: ConversionResult['confidence'],
	results: ConversionResult[],
	defaultCondition?: string,
	exportOptions?: ExportOptions,
	progressCallback?: ProgressCallback
): Promise<void> {
	if (cards.length === 0) return;

	// Fetch Scryfall sets once for this batch
	let scryfallSets: ScryfallSet[];
	try {
		scryfallSets = await fetchScryfallSets();
		await delay(RATE_LIMIT_DELAY); // Respect rate limit
	} catch (error) {
		// If we can't fetch sets, mark all cards as failed
		logError(
			'Failed to fetch Scryfall sets for fuzzy matching',
			error instanceof Error ? error : new Error(String(error))
		);
		cards.forEach((card) => {
			results.push({
				originalCard: card,
				moxfieldRow: createMoxfieldRow(card, undefined, defaultCondition),
				success: false,
				error: 'Failed to fetch Scryfall sets for fuzzy matching',
				confidence: 'low',
				identificationMethod: 'failed'
			});
		});
		return;
	}

	// First pass: fuzzy match set names and prepare cards for batching
	const cardsWithMatchedSets: Array<{ card: ParsedCard; setCode: string }> = [];

	for (const card of cards) {
		if (!card.editionName || !card.name) {
			results.push({
				originalCard: card,
				moxfieldRow: createMoxfieldRow(card, undefined, defaultCondition),
				success: false,
				error: 'Missing edition name or card name for fuzzy matching',
				confidence: 'low',
				identificationMethod: 'failed'
			});
			continue;
		}

		// Try to fuzzy match the edition name to a Scryfall set
		const matchedSetCode = fuzzyMatchSetName(card.editionName!, scryfallSets);

		if (!matchedSetCode) {
			results.push({
				originalCard: card,
				moxfieldRow: createMoxfieldRow(card, undefined, defaultCondition),
				success: false,
				error: `Could not match set name: ${card.editionName}`,
				confidence: 'low',
				identificationMethod: 'failed'
			});
			continue;
		}

		cardsWithMatchedSets.push({ card, setCode: matchedSetCode });
	}

	// Second pass: batch lookup cards using collection endpoint
	if (cardsWithMatchedSets.length > 0) {
		await processFuzzySetCardsBatched(
			cardsWithMatchedSets,
			results,
			identificationMethod,
			confidence,
			defaultCondition,
			progressCallback
		);
	}
}

/**
 * Processes fuzzy matched cards in batches using the collection endpoint
 */
async function processFuzzySetCardsBatched(
	cardsWithSets: Array<{ card: ParsedCard; setCode: string }>,
	results: ConversionResult[],
	identificationMethod: ConversionResult['identificationMethod'],
	confidence: ConversionResult['confidence'],
	defaultCondition?: string,
	progressCallback?: ProgressCallback
): Promise<void> {
	// Process in batches of up to 75 (Scryfall collection endpoint limit)
	for (let i = 0; i < cardsWithSets.length; i += BATCH_SIZE) {
		const batch = cardsWithSets.slice(i, i + BATCH_SIZE);

		// Create identifiers for this batch
		const identifiers: CardIdentifier[] = batch.map(({ card, setCode }) => ({
			name: extractFrontFaceName(card.name),
			set: setCode.toLowerCase()
		}));

		try {
			logDebug(`Fuzzy batch lookup: ${identifiers.length} cards`);
			const response = await fetchScryfallCollection(identifiers);
			await delay(RATE_LIMIT_DELAY); // Respect rate limit

			// Match results back to original cards
			for (let j = 0; j < batch.length; j++) {
				const { card, setCode } = batch[j];

				// Find matching cards in response
				const matchingCards = response.data.filter((scryfallCard) => {
					// Match by name and set
					const cardName = extractFrontFaceName(card.name).toLowerCase();
					const scryfallName = extractFrontFaceName(scryfallCard.name).toLowerCase();
					return (
						scryfallName === cardName && scryfallCard.set.toLowerCase() === setCode.toLowerCase()
					);
				});

				if (matchingCards.length > 0) {
					const scryfallCard = selectBestCardMatch(card, matchingCards);
					results.push({
						originalCard: card,
						scryfallCard,
						moxfieldRow: createMoxfieldRow(card, scryfallCard, defaultCondition),
						success: true,
						confidence,
						identificationMethod
					});
					logDebug(`Found card via fuzzy set matching: ${card.name} in ${setCode}`);
				} else {
					// Card not found in collection endpoint, try search endpoint as fallback
					await trySearchEndpointFallback(
						card,
						setCode,
						results,
						confidence,
						identificationMethod,
						defaultCondition
					);
				}
			}
		} catch (error) {
			// Mark all cards in this batch as failed
			batch.forEach(({ card }) => {
				results.push({
					originalCard: card,
					moxfieldRow: createMoxfieldRow(card, undefined, defaultCondition),
					success: false,
					error: `Scryfall API error: ${error instanceof Error ? error.message : String(error)}`,
					confidence: 'low',
					identificationMethod: 'failed'
				});
			});
		}

		// Update progress
		if (progressCallback) {
			const progress = ((i + batch.length) / cardsWithSets.length) * 100;
			progressCallback(Math.min(100, progress));
		}
	}
}

/**
 * Fallback to search endpoint for cards not found via collection endpoint
 */
async function trySearchEndpointFallback(
	card: ParsedCard,
	setCode: string,
	results: ConversionResult[],
	confidence: ConversionResult['confidence'],
	identificationMethod: ConversionResult['identificationMethod'],
	defaultCondition?: string
): Promise<void> {
	try {
		const cardName = extractFrontFaceName(card.name);
		const query = `!"${cardName}" set:${setCode}`;

		const response = await fetch(
			`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`
		);
		await delay(RATE_LIMIT_DELAY);

		if (response.ok) {
			const data = await response.json();
			if (data.data && data.data.length > 0) {
				const scryfallCard = selectBestCardMatch(card, data.data);
				results.push({
					originalCard: card,
					scryfallCard,
					moxfieldRow: createMoxfieldRow(card, scryfallCard, defaultCondition),
					success: true,
					confidence,
					identificationMethod
				});
				logDebug(`Found card via search fallback: ${card.name} in ${setCode}`);
				return;
			}
		}
	} catch (error) {
		logDebug(`Search fallback failed for ${card.name}: ${error}`);
	}

	// If we get here, both collection and search failed
	results.push({
		originalCard: card,
		moxfieldRow: createMoxfieldRow(card, undefined, defaultCondition),
		success: false,
		error: `Card not found: ${card.name} in set ${setCode}`,
		confidence: 'low',
		identificationMethod: 'failed'
	});
}

/**
 * Selects the best card match from multiple Scryfall results
 */
function selectBestCardMatch(card: ParsedCard, scryfallCards: ScryfallCard[]): ScryfallCard {
	if (scryfallCards.length === 1) {
		return scryfallCards[0];
	}

	// Prefer exact name matches
	const exactNameMatches = scryfallCards.filter(
		(sc) => sc.name.toLowerCase() === card.name.toLowerCase()
	);
	if (exactNameMatches.length === 1) {
		return exactNameMatches[0];
	}

	// Prefer matches with collector number if available
	if (card.collectorNumber) {
		const collectorMatches = scryfallCards.filter(
			(sc) => sc.collector_number === card.collectorNumber
		);
		if (collectorMatches.length > 0) {
			return collectorMatches[0];
		}
	}

	// For DFC cards, prefer front face matches
	if (card.name.includes(' // ')) {
		const frontFaceName = extractFrontFaceName(card.name);
		const frontFaceMatches = scryfallCards.filter(
			(sc) => sc.name.toLowerCase() === frontFaceName.toLowerCase()
		);
		if (frontFaceMatches.length > 0) {
			return frontFaceMatches[0];
		}
	}

	// Prefer cards that contain the search name
	const nameContainsMatches = scryfallCards.filter((sc) =>
		sc.name.toLowerCase().includes(card.name.toLowerCase())
	);
	if (nameContainsMatches.length > 0) {
		return nameContainsMatches[0];
	}

	// If name is contained in any card name
	const containsNameMatches = scryfallCards.filter((sc) =>
		card.name.toLowerCase().includes(sc.name.toLowerCase())
	);
	if (containsNameMatches.length > 0) {
		return containsNameMatches[0];
	}

	return scryfallCards[0]; // Default to first result
}

/**
 * Consolidates identical cards by summing their counts.
 * Only consolidates cards where ALL fields are identical except for count.
 * This prevents data loss by being extremely conservative about what constitutes "identical".
 */
function consolidateIdenticalCards(cards: ParsedCard[]): ParsedCard[] {
	if (cards.length <= 1) return cards;

	const consolidated: ParsedCard[] = [];
	const processedIndices = new Set<number>();

	for (let i = 0; i < cards.length; i++) {
		if (processedIndices.has(i)) continue;

		const baseCard = cards[i];
		let totalCount = baseCard.count;
		const identicalIndices = [i];

		// Find all identical cards
		for (let j = i + 1; j < cards.length; j++) {
			if (processedIndices.has(j)) continue;

			const compareCard = cards[j];

			// Check if cards are truly identical (except for count)
			if (areCardsIdentical(baseCard, compareCard)) {
				totalCount += compareCard.count;
				identicalIndices.push(j);
			}
		}

		// Mark all identical cards as processed
		identicalIndices.forEach((idx) => processedIndices.add(idx));

		// Create consolidated card
		const consolidatedCard = { ...baseCard };
		consolidatedCard.count = totalCount;
		consolidated.push(consolidatedCard);

		if (identicalIndices.length > 1) {
			logDebug(
				`Consolidated ${identicalIndices.length} identical cards: ${baseCard.name} (total count: ${totalCount})`
			);
		}
	}

	return consolidated;
}

/**
 * Checks if two cards are identical in all fields except count.
 * This is extremely conservative to prevent any data loss.
 */
function areCardsIdentical(card1: ParsedCard, card2: ParsedCard): boolean {
	// List of all fields to compare (excluding count)
	const fieldsToCompare: (keyof ParsedCard)[] = [
		'name',
		'edition',
		'editionName',
		'condition',
		'language',
		'foil',
		'tags',
		'purchasePrice',
		'collectorNumber',
		'tradelistCount',
		'lastModified',
		'alter',
		'proxy',
		'signed',
		'notes',
		'scryfallId',
		'multiverseId',
		'mtgoId',
		'needsLookup',
		'conversionStatus',
		'error'
	];

	// Compare each field
	for (const field of fieldsToCompare) {
		const val1 = card1[field];
		const val2 = card2[field];

		// Handle undefined/null/empty string equivalency for string fields
		if (typeof val1 === 'string' || typeof val2 === 'string') {
			const norm1 = val1 || '';
			const norm2 = val2 || '';
			if (norm1 !== norm2) return false;
		} else {
			// For non-string fields, require exact equality
			if (val1 !== val2) return false;
		}
	}

	// Additional check: compare originalData objects if they exist
	if (card1.originalData && card2.originalData) {
		const keys1 = Object.keys(card1.originalData);
		const keys2 = Object.keys(card2.originalData);

		if (keys1.length !== keys2.length) return false;

		for (const key of keys1) {
			if (card1.originalData[key] !== card2.originalData[key]) return false;
		}
	} else if (card1.originalData !== card2.originalData) {
		// One has originalData, the other doesn't
		return false;
	}

	return true;
}

/**
 * Consolidates identical conversion results by summing their counts.
 * This is applied after Scryfall lookup to combine results that resolve to the same card.
 */
function consolidateIdenticalResults(results: ConversionResult[]): ConversionResult[] {
	if (results.length <= 1) return results;

	const consolidated: ConversionResult[] = [];
	const processedIndices = new Set<number>();

	for (let i = 0; i < results.length; i++) {
		if (processedIndices.has(i)) continue;

		const baseResult = results[i];
		let totalCount = parseInt(baseResult.moxfieldRow.Count) || 0;
		const identicalIndices = [i];

		// Find all identical results
		for (let j = i + 1; j < results.length; j++) {
			if (processedIndices.has(j)) continue;

			const compareResult = results[j];

			// Check if results are truly identical (except for count)
			if (areResultsIdentical(baseResult, compareResult)) {
				totalCount += parseInt(compareResult.moxfieldRow.Count) || 0;
				identicalIndices.push(j);
			}
		}

		// Mark all identical results as processed
		identicalIndices.forEach((idx) => processedIndices.add(idx));

		// Create consolidated result
		const consolidatedResult = { ...baseResult };
		consolidatedResult.moxfieldRow = { ...baseResult.moxfieldRow };
		consolidatedResult.moxfieldRow.Count = totalCount.toString();
		consolidated.push(consolidatedResult);

		if (identicalIndices.length > 1) {
			logDebug(
				`Consolidated ${identicalIndices.length} identical results: ${baseResult.moxfieldRow.Name} (total count: ${totalCount})`
			);
		}
	}

	return consolidated;
}

/**
 * Checks if two conversion results are identical in all meaningful fields except count.
 * This focuses on the final Moxfield row data to determine if entries should be consolidated.
 */
function areResultsIdentical(result1: ConversionResult, result2: ConversionResult): boolean {
	// Both must have same success status
	if (result1.success !== result2.success) return false;

	// If both failed, compare error messages
	if (!result1.success && !result2.success) {
		return result1.error === result2.error;
	}

	// If both succeeded, compare the moxfield row data (excluding count fields)
	if (result1.success && result2.success) {
		const row1 = result1.moxfieldRow;
		const row2 = result2.moxfieldRow;

		// List of fields to compare (excluding count-related fields)
		const fieldsToCompare = [
			'Name',
			'Edition',
			'Condition',
			'Language',
			'Foil',
			'Tags',
			'Collector Number',
			'Alter',
			'Proxy',
			'Signed',
			'Purchase Price'
			// Note: We intentionally exclude 'Count' and 'Tradelist Count'
		];

		for (const field of fieldsToCompare) {
			const val1 = row1[field] || '';
			const val2 = row2[field] || '';
			if (val1 !== val2) return false;
		}

		// Also compare any additional fields that might exist (like price/ID fields)
		const allKeys = new Set([...Object.keys(row1), ...Object.keys(row2)]);
		for (const key of allKeys) {
			// Skip count fields and already compared fields
			if (key === 'Count' || key === 'Tradelist Count' || fieldsToCompare.includes(key)) {
				continue;
			}

			const val1 = row1[key] || '';
			const val2 = row2[key] || '';
			if (val1 !== val2) return false;
		}

		return true;
	}

	return false;
}
