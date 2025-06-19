export interface CardIdentifier {
	// Scryfall card identifiers
	id?: string; // Scryfall ID (UUID)
	mtgo_id?: number; // MTGO ID
	multiverse_id?: number; // Multiverse ID
	oracle_id?: string; // Oracle ID (UUID)
	illustration_id?: string; // Illustration ID (UUID)
	name?: string; // Card name
	set?: string; // Set code
	collector_number?: string; // Collector number
}

export interface ParsedCard {
	// Original data from CSV
	originalData: Record<string, string>;
	// Parsed/normalized data
	count: number;
	name: string;
	edition?: string; // Set code
	editionName?: string; // Full edition name for fuzzy matching
	condition?: string;
	language?: string;
	foil?: string;
	isEtched?: boolean; // Whether this card is etched foil
	tags?: string;
	extras?: string; // For format-specific extra data (e.g., Helvault extras)
	purchasePrice?: string;
	collectorNumber?: string;
	// Additional Moxfield/advanced fields
	tradelistCount?: string;
	lastModified?: string;
	alter?: string;
	proxy?: string;
	signed?: string;
	notes?: string; // For extra tags that don't fit elsewhere
	// Scryfall identifiers (if available from CSV)
	scryfallId?: string;
	multiverseId?: number;
	mtgoId?: number;
	jsonId?: string; // CardCastle's JSON ID field (Scryfall ID with potential DFC issue)
	// Conversion tracking
	needsLookup: boolean;
	conversionStatus?: 'pending' | 'success' | 'failed';
	error?: string;

	// New 3-step process properties
	initialConfidence?: 'very_high' | 'high' | 'medium' | 'low';
	warnings?: string[];
	setCodeCorrected?: boolean;
	foundViaNameCollectorSearch?: boolean; // Flag for cards found via special name+collector# search
	scryfallCardData?: ScryfallCard; // Full Scryfall card data (when found via search)
	sourceRowNumber?: number; // Row number in the source CSV (1-based, excluding header)

	// Allow string indexing for transformations
	[key: string]:
		| string
		| number
		| Record<string, string>
		| boolean
		| string[]
		| ScryfallCard
		| undefined;
}

export interface ScryfallCard {
	id: string;
	name: string;
	set: string;
	set_name: string;
	collector_number: string;
	rarity: string;
	mana_cost?: string;
	type_line: string;
	oracle_text?: string;
	power?: string;
	toughness?: string;
	colors?: string[];
	color_identity?: string[];
	legalities: Record<string, string>;
	reserved: boolean;
	foil: boolean;
	nonfoil: boolean;
	finishes: string[];
	prices: {
		usd?: string;
		usd_foil?: string;
		usd_etched?: string;
		eur?: string;
		eur_foil?: string;
		tix?: string;
	};
	multiverse_ids?: number[];
	mtgo_id?: number;
	mtgo_foil_id?: number;
	tcgplayer_id?: number;
	cardmarket_id?: number;
	lang: string;
	released_at: string;
	uri: string;
	scryfall_uri: string;
	layout: string;
	image_uris?: {
		small?: string;
		normal?: string;
		large?: string;
		png?: string;
		art_crop?: string;
		border_crop?: string;
	};
}

export interface ConversionResult {
	originalCard: ParsedCard;
	scryfallCard?: ScryfallCard;
	moxfieldRow: Record<string, string>;
	success: boolean;
	error?: string;
	confidence: 'very_high' | 'high' | 'medium' | 'low';
	initialConfidence?: 'very_high' | 'high' | 'medium' | 'low'; // Confidence at parse time (optional for backwards compatibility)
	identificationMethod:
		| 'scryfall_id'
		| 'multiverse_id'
		| 'mtgo_id'
		| 'set_collector'
		| 'set_collector_corrected' // Set code was corrected via fuzzy matching
		| 'name_set'
		| 'name_set_corrected' // Set code was corrected via fuzzy matching
		| 'name_collector' // Found via name + collector number search
		| 'name_only'
		| 'failed';
	warnings?: string[]; // For validation warnings, language mismatches, etc.
	setCodeCorrected?: boolean; // Whether the set code was corrected via fuzzy matching
	languageMismatch?: boolean; // Whether there was a language mismatch that was corrected
	sourceRowNumber?: number; // Row number in the source CSV (1-based, excluding header)
	outputRowNumber?: number; // Row number in the output CSV (1-based, excluding header)
}

export interface ValidationResult {
	isValid: boolean;
	warnings: string[];
	errors: string[];
}

export interface ApiHealthResult {
	available: boolean;
	error?: string;
}

export interface SetValidationResult {
	hasInvalidSetCodes: boolean;
	invalidSetCodes: string[];
	correctedSetCodes: Array<{
		original: string;
		corrected: string;
		confidence: number;
		setName?: string;
	}>;
	warnings: string[];
}

export interface CsvFormat {
	name: string;
	id: string;
	description: string;
	columnMappings: Record<string, string>;
	transformations?: Record<string, (value: string) => string>;
	hasHeaders: boolean;
	delimiter?: string;
}

export interface ConverterEngine {
	convertFile: (
		file: File,
		format: string,
		progressCallback?: (progress: number) => void,
		defaultCondition?: string,
		exportOptions?: ExportOptions
	) => Promise<ConversionResult[]>;

	convertPrevalidatedCards: (
		validatedCards: ParsedCard[],
		progressCallback?: (progress: number) => void,
		defaultCondition?: string,
		exportOptions?: ExportOptions
	) => Promise<ConversionResult[]>;

	parseFile: (file: File, format: string) => Promise<ParsedCard[]>;

	getSupportedFormats: () => CsvFormat[];
	detectFormat: (headers: string[]) => string | null;

	// API health and validation methods
	checkApiHealth: () => Promise<ApiHealthResult>;
	validateSetCodes: (cards: ParsedCard[]) => Promise<SetValidationResult>;
}

export interface ScryfallResponse {
	object: string;
	data: ScryfallCard[];
	not_found: CardIdentifier[];
	warnings?: string[];
}

export type ProgressCallback = (progress: number) => void;

export interface ExportOptions {
	includeCurrentPrice: boolean;
	priceType: 'usd' | 'eur' | 'tix'; // Will be modified based on foil/etched status
	includeMtgoIds: boolean;
	includeMultiverseId: boolean;
	includeTcgPlayerId: boolean;
	includeCardMarketId: boolean;
}

export interface ScryfallSet {
	object: string;
	id: string;
	code: string;
	name: string;
	uri: string;
	scryfall_uri: string;
	search_uri: string;
	released_at: string;
	set_type: string;
	card_count: number;
	digital: boolean;
	nonfoil_only: boolean;
	foil_only: boolean;
	icon_svg_uri: string;
}

export interface ScryfallSetsResponse {
	object: string;
	data: ScryfallSet[];
}
