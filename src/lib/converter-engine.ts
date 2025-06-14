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
			foil: (value: string) => normalizeTappedOutFoil(value),
			alter: (value: string) => normalizeTappedOutBoolean(value),
			signed: (value: string) => normalizeTappedOutBoolean(value),
			proxy: (value: string) => normalizeTappedOutBoolean(value)
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
			foil: (value: string) => normalizeCardsphereFoil(value),
			edition: (value: string) => normalizeCardsphereEdition(value)
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
		name: 'Simple Test Format',
		id: 'simple-test',
		description: 'Simple format for testing fuzzy set matching',
		hasHeaders: true,
		columnMappings: {
			count: 'Quantity',
			name: 'Name',
			editionName: 'Set' // Uses editionName to trigger fuzzy matching
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

		// Special handling for Cardsphere etched foils
		if (format.id === 'cardsphere') {
			// Check if the original edition had "Etched Foil" suffix
			const originalEdition = getColumnValue(originalData, format.columnMappings.edition, '');
			if (originalEdition.endsWith(' Etched Foil') && card.foil === 'foil') {
				// This is an etched foil card
				card.foil = 'etched';
			}
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

			logDebug(`Parsed ${cards.length} cards from CSV`); // Convert cards
			try {
				const results = await lookupCardsInBatches(
					cards,
					progressCallback,
					defaultCondition,
					exportOptions
				);

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

// Cache for Scryfall sets to avoid repeated API calls
let scryfallSetsCache: ScryfallSet[] | null = null;

async function fetchScryfallSets(): Promise<ScryfallSet[]> {
	if (scryfallSetsCache) {
		return scryfallSetsCache;
	}

	try {
		const response = await fetch('https://api.scryfall.com/sets');

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data: ScryfallSetsResponse = await response.json();
		scryfallSetsCache = data.data;

		logDebug(`Fetched ${data.data.length} Scryfall sets for fuzzy matching`);
		return data.data;
	} catch (error) {
		logError(
			'Failed to fetch Scryfall sets',
			error instanceof Error ? error : new Error(String(error))
		);
		throw new ConversionError('Failed to fetch Scryfall sets for fuzzy matching');
	}
}

async function searchScryfallCard(cardName: string, setCode: string): Promise<ScryfallCard | null> {
	try {
		const query = `"${cardName}" e:${setCode}`;
		const encodedQuery = encodeURIComponent(query);
		const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodedQuery}`);

		if (response.status === 404) {
			// No cards found - this is expected for failed matches
			return null;
		}

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();

		// Return the first result if any cards were found
		if (data.data && data.data.length > 0) {
			logDebug(`Found card via fuzzy set matching: ${cardName} in ${setCode}`);
			return data.data[0];
		}

		return null;
	} catch (error) {
		logError(
			`Failed to search for card: ${cardName} in set ${setCode}`,
			error instanceof Error ? error : new Error(String(error))
		);
		return null;
	}
}

function fuzzyMatchSetName(editionName: string, scryfallSets: ScryfallSet[]): ScryfallSet | null {
	if (!editionName) return null;

	const cleanInput = editionName.toLowerCase().trim();

	// First try exact match
	for (const set of scryfallSets) {
		if (set.name.toLowerCase() === cleanInput) {
			return set;
		}
	}

	// Handle World Championship Decks specifically
	if (cleanInput.includes('world championship deck')) {
		// Extract year from the input
		const yearMatch = cleanInput.match(/(\d{4})/);
		if (yearMatch) {
			const year = yearMatch[1];
			const targetName = `world championship decks ${year}`;

			for (const set of scryfallSets) {
				if (set.name.toLowerCase() === targetName) {
					logDebug(
						`Fuzzy matched World Championship Deck: "${editionName}" -> "${set.name}" (${set.code})`
					);
					return set;
				}
			}
		}
	}

	// Try partial matching for other sets
	for (const set of scryfallSets) {
		const setName = set.name.toLowerCase();

		// Check if the set name contains most of the input words
		const inputWords = cleanInput.split(/\s+/).filter((word) => word.length > 2);
		const matchedWords = inputWords.filter((word) => setName.includes(word));

		// Require at least 70% of significant words to match
		if (inputWords.length > 0 && matchedWords.length / inputWords.length >= 0.7) {
			logDebug(`Fuzzy matched set: "${editionName}" -> "${set.name}" (${set.code})`);
			return set;
		}
	}

	logDebug(`No fuzzy match found for set: "${editionName}"`);
	return null;
}

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

	for (let i = 0; i < cards.length; i++) {
		const card = cards[i];

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
		const matchedSet = fuzzyMatchSetName(card.editionName!, scryfallSets);

		if (!matchedSet) {
			results.push({
				originalCard: card,
				moxfieldRow: createMoxfieldRow(card, undefined, defaultCondition),
				success: false,
				error: `No fuzzy match found for edition: "${card.editionName}"`,
				confidence: 'low',
				identificationMethod: 'failed'
			});
			continue;
		}

		// Try to find the card in the matched set
		await delay(RATE_LIMIT_DELAY); // Respect rate limit
		const scryfallCard = await searchScryfallCard(card.name, matchedSet.code);

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
			results.push({
				originalCard: card,
				moxfieldRow: createMoxfieldRow(card, undefined, defaultCondition),
				success: false,
				error: `Card "${card.name}" not found in fuzzy-matched set "${matchedSet.name}" (${matchedSet.code})`,
				confidence: 'low',
				identificationMethod: 'failed'
			});
		}
		// Report progress
		if (progressCallback) {
			const progress = ((i + 1) / cards.length) * 100;
			progressCallback(Math.min(100, progress));
		}
	}
}

function normalizeTappedOutFoil(foil: string): string {
	// TappedOut uses various foil indicators
	const lowerFoil = foil.toLowerCase().trim();
	if (lowerFoil === 'foil' || lowerFoil === 'yes' || lowerFoil === '1' || lowerFoil === 'true') {
		return 'foil';
	}
	return '';
}

function normalizeTappedOutBoolean(value: string): string {
	// TappedOut uses various boolean indicators for alter, proxy, signed
	const lowerValue = value.toLowerCase().trim();
	if (lowerValue === 'yes' || lowerValue === '1' || lowerValue === 'true' || lowerValue === 'x') {
		return 'True';
	}
	return 'False';
}

function normalizeCardsphereFoil(foil: string): string {
	// Cardsphere uses 'F' for foil/etched and 'N' for non-foil
	if (foil === 'F') return 'foil';
	return '';
}

function normalizeCardsphereEdition(edition: string): string {
	// Handle the etched foil edge case where Cardsphere appends "Etched Foil" to edition names
	// This helps disambiguate cards that share Scryfall IDs between regular and etched versions
	if (edition.endsWith(' Etched Foil')) {
		return edition.slice(0, -12); // Remove " Etched Foil" suffix
	}
	return edition;
}
