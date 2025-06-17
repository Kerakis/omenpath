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
	tags?: string;
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

	// Conversion tracking
	needsLookup: boolean;
	conversionStatus?: 'pending' | 'success' | 'failed';
	error?: string;

	// Allow string indexing for transformations
	[key: string]: string | number | Record<string, string> | boolean | undefined;
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
	confidence: 'high' | 'medium' | 'low';
	identificationMethod:
		| 'scryfall_id'
		| 'multiverse_id'
		| 'mtgo_id'
		| 'set_collector'
		| 'name_set'
		| 'fuzzy_set'
		| 'name_only'
		| 'failed';
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

	parseFile: (file: File, format: string) => Promise<ParsedCard[]>;

	getSupportedFormats: () => CsvFormat[];
	detectFormat: (headers: string[]) => string | null;
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
