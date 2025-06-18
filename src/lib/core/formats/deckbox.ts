import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';

// Utility functions (reusing from archidekt for consistency)
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
	return languageMap[normalized] || 'English';
}

export const deckboxFormat: CsvFormat = {
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
		condition: normalizeCondition,
		language: normalizeLanguage,
		foil: (value: string) => (value.toLowerCase() === 'true' || value === '1' ? 'foil' : '')
	}
};

export const deckboxModule: FormatModule = {
	format: deckboxFormat,
	detectFormat: (headers: string[]): number => {
		const headerSet = new Set(headers.map((h) => h.toLowerCase()));

		// Strong indicators for DeckBox
		const strongIndicators = [
			'card number', // DeckBox uses "Card Number" instead of "Collector Number"
			'edition code' // Combined with "Edition" suggests DeckBox
		];

		// Common DeckBox indicators
		const commonIndicators = [
			'count', // DeckBox uses "Count" instead of "Quantity"
			'name',
			'edition', // Full edition name
			'condition',
			'language',
			'foil',
			'scryfall id'
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
				score += 0.07; // Each common match is worth 7%
			}
		}

		// Special bonus for having both "Edition" and "Edition Code"
		if (headerSet.has('edition') && headerSet.has('edition code')) {
			score += 0.2;
		}

		// Bonus for using "Count" instead of "Quantity"
		if (headerSet.has('count') && !headerSet.has('quantity')) {
			score += 0.1;
		}

		// If we have strong indicators, this is likely DeckBox
		if (strongMatches > 0) {
			score += 0.1;
		}

		return Math.min(score, 1.0);
	}
};
