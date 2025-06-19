import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';

// Utility functions for normalization
function normalizeCondition(value: string): string {
	if (!value) return 'Near Mint';
	const normalized = value.toLowerCase().trim();
	switch (normalized) {
		case 'mint':
		case 'm':
			return 'Mint';
		case 'near mint':
		case 'nm':
		case 'near-mint':
			return 'Near Mint';
		case 'lightly played':
		case 'light played':
		case 'slightly played':
		case 'lp':
		case 'sp':
			return 'Lightly Played';
		case 'moderately played':
		case 'mp':
			return 'Moderately Played';
		case 'heavily played':
		case 'hp':
			return 'Heavily Played';
		case 'damaged':
		case 'dmg':
		case 'd':
			return 'Damaged';
		default:
			return 'Near Mint';
	}
}

function normalizeLanguage(value: string): string {
	if (!value) return 'English';
	const normalized = value.toLowerCase().trim();
	const languageMap: Record<string, string> = {
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
		ja: 'Japanese',
		japanese: 'Japanese',
		ko: 'Korean',
		korean: 'Korean',
		ru: 'Russian',
		russian: 'Russian'
	};
	// Return the mapped value if found, otherwise return the original value
	// This preserves unknown language codes like "qqq" for proper validation
	return languageMap[normalized] || value;
}

export const archidektFormat: CsvFormat = {
	name: 'Archidekt',
	id: 'archidekt',
	description:
		'Archidekt collection export (💡 Tip: Include Scryfall ID, Condition, Language, and Foil finish when exporting for best accuracy)',
	hasHeaders: true,
	columnMappings: {
		count: 'Quantity',
		name: 'Name',
		edition: 'Edition Code',
		editionName: 'Edition Name', // Full edition name for fuzzy matching
		condition: 'Condition',
		language: 'Language',
		foil: 'Finish',
		purchasePrice: 'Purchase Price',
		collectorNumber: 'Collector Number',
		scryfallId: 'Scryfall ID',
		multiverseId: 'Multiverse Id',
		mtgoId: 'MTGO ID', // Digital card support
		scryfallOracleId: 'Scryfall Oracle ID', // Additional Scryfall field
		tags: 'Tags', // We'll parse this for proxy/signed/altered status
		dateAdded: 'Date Added', // Archidekt-specific tracking
		rarity: 'Rarity',
		manaValue: 'Mana Value',
		manaCost: 'Mana cost',
		colors: 'Colors',
		colorIdentity: 'Identities',
		types: 'Types',
		subtypes: 'Sub-types',
		supertypes: 'Super-types',
		// Price fields from various vendors
		priceCardKingdom: 'Price (Card Kingdom)',
		priceTcgPlayer: 'Price (TCG Player)',
		priceStarCityGames: 'Price (Star City Games)',
		priceCardHoarder: 'Price (Card Hoarder)',
		priceCardMarket: 'Price (Card Market)'
	},
	transformations: {
		condition: normalizeCondition,
		language: normalizeLanguage,
		foil: (value: string) => {
			const normalized = value.toLowerCase().trim();
			if (normalized === 'foil') return 'foil';
			if (normalized === 'etched') return 'etched';
			return ''; // Normal, Non-foil, etc.
		},
		tags: (value: string) => value, // Keep tags as-is for parsing later
		// Normalize comma-separated lists to consistent format
		colors: (value: string) =>
			value
				? value
						.split(',')
						.map((c) => c.trim())
						.join(', ')
				: '',
		colorIdentity: (value: string) =>
			value
				? value
						.split(',')
						.map((c) => c.trim())
						.join(', ')
				: '',
		types: (value: string) =>
			value
				? value
						.split(',')
						.map((t) => t.trim())
						.join(', ')
				: '',
		subtypes: (value: string) =>
			value
				? value
						.split(',')
						.map((t) => t.trim())
						.join(', ')
				: '',
		supertypes: (value: string) =>
			value
				? value
						.split(',')
						.map((t) => t.trim())
						.join(', ')
				: ''
	}
};

export const archidektModule: FormatModule = {
	format: archidektFormat,
	detectFormat: (headers: string[]): number => {
		const headerSet = new Set(headers.map((h) => h.toLowerCase()));

		// Strong indicators for Archidekt (unique or very distinctive columns)
		const strongIndicators = [
			'date added', // Very distinctive to Archidekt
			'scryfall oracle id', // Archidekt includes both Scryfall ID and Oracle ID
			'finish', // Archidekt uses "Finish" instead of "Foil"
			'price (card kingdom)', // Specific pricing format
			'price (tcg player)', // Specific pricing format
			'identities' // Color identity field unique to Archidekt
		];

		// Common Archidekt indicators
		const commonIndicators = [
			'quantity',
			'name',
			'condition',
			'language',
			'purchase price',
			'tags',
			'edition name', // Both Edition Name and Code
			'edition code',
			'multiverse id', // Archidekt-specific capitalization
			'scryfall id',
			'mtgo id',
			'collector number',
			'mana value',
			'colors',
			'mana cost',
			'types',
			'sub-types',
			'super-types',
			'rarity'
		];

		let score = 0;
		let strongMatches = 0;

		// Check strong indicators
		for (const indicator of strongIndicators) {
			if (headerSet.has(indicator)) {
				strongMatches++;
				score += 0.35; // Each strong match is worth 35%
			}
		}

		// Check common indicators
		for (const indicator of commonIndicators) {
			if (headerSet.has(indicator)) {
				score += 0.05; // Each common match is worth 5%
			}
		}

		// Special bonuses for Archidekt-specific combinations
		if (headerSet.has('finish') && !headerSet.has('foil')) {
			score += 0.2; // Strong indicator when Finish is used instead of Foil
		}

		if (headerSet.has('edition name') && headerSet.has('edition code')) {
			score += 0.15; // Archidekt often exports both
		}

		if (headerSet.has('scryfall id') && headerSet.has('scryfall oracle id')) {
			score += 0.15; // Both Scryfall fields is very distinctive
		}

		// Multiple price fields indicate full Archidekt export
		const priceFields = [
			'price (card kingdom)',
			'price (tcg player)',
			'price (star city games)',
			'price (card hoarder)',
			'price (card market)'
		];
		const priceMatches = priceFields.filter((field) => headerSet.has(field)).length;
		if (priceMatches >= 3) {
			score += 0.2; // Multiple vendor prices are very distinctive
		}

		// If we have strong indicators, this is likely Archidekt
		if (strongMatches > 0) {
			score += 0.1;
		}

		return Math.min(score, 1.0);
	}
};
