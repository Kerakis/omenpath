import type { CsvFormat } from '../types.js';
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
	return languageMap[normalized] || 'English';
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
		condition: 'Condition',
		language: 'Language',
		foil: 'Finish',
		purchasePrice: 'Purchase Price',
		collectorNumber: 'Collector Number',
		scryfallId: 'Scryfall ID',
		multiverseId: 'Multiverse Id'
	},
	transformations: {
		condition: normalizeCondition,
		language: normalizeLanguage,
		foil: (value: string) => (value.toLowerCase() === 'foil' ? 'foil' : '')
	}
};

export const archidektModule: FormatModule = {
	format: archidektFormat,
	detectFormat: (headers: string[]): number => {
		const headerSet = new Set(headers.map((h) => h.toLowerCase()));

		// Strong indicators for Archidekt
		const strongIndicators = [
			'multiverse id', // Archidekt-specific capitalization
			'edition code' // Common in Archidekt exports
		];

		// Common Archidekt indicators
		const commonIndicators = [
			'quantity',
			'name',
			'condition',
			'language',
			'finish', // Archidekt uses "Finish" instead of "Foil"
			'purchase price',
			'collector number',
			'scryfall id'
		];

		let score = 0;
		let strongMatches = 0;

		// Check strong indicators
		for (const indicator of strongIndicators) {
			if (headerSet.has(indicator)) {
				strongMatches++;
				score += 0.4; // Each strong match is worth 40%
			}
		}

		// Check common indicators
		for (const indicator of commonIndicators) {
			if (headerSet.has(indicator)) {
				score += 0.08; // Each common match is worth 8%
			}
		}

		// Special bonus for having "Finish" instead of "Foil"
		if (headerSet.has('finish') && !headerSet.has('foil')) {
			score += 0.15;
		}

		// If we have strong indicators, this is likely Archidekt
		if (strongMatches > 0) {
			score += 0.1;
		}

		return Math.min(score, 1.0);
	}
};
