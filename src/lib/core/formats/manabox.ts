import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';

// Utility functions for ManaBox format
function normalizeManaBoxCondition(value: string): string {
	if (!value) return 'Near Mint';
	const normalized = value.toLowerCase().trim();
	switch (normalized) {
		case 'mint':
		case 'm':
			return 'Mint';
		case 'near mint':
		case 'nm':
		case 'excellent': // ManaBox uses 'excellent' for near mint condition
			return 'Near Mint';
		case 'lightly played':
		case 'light played':
		case 'light_played': // ManaBox uses underscore
		case 'slightly played':
		case 'lp':
		case 'sp':
		case 'good': // ManaBox uses 'good' for lightly played
			return 'Lightly Played';
		case 'moderately played':
		case 'mp':
		case 'played': // ManaBox uses 'played' for moderately played
			return 'Moderately Played';
		case 'heavily played':
		case 'hp':
			return 'Heavily Played';
		case 'damaged':
		case 'dmg':
		case 'd':
		case 'poor': // ManaBox uses 'poor' for damaged
			return 'Damaged';
		default:
			return 'Near Mint';
	}
}

function normalizeManaBoxLanguage(value: string): string {
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
		russian: 'Russian',
		'zh-cn': 'Chinese Simplified',
		'chinese simplified': 'Chinese Simplified',
		'zh-tw': 'Chinese Traditional',
		'chinese traditional': 'Chinese Traditional'
	};
	return languageMap[normalized] || 'English';
}

export const manaboxFormat: CsvFormat = {
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
		condition: normalizeManaBoxCondition,
		language: normalizeManaBoxLanguage,
		foil: (value: string) => (value.toLowerCase() === 'foil' ? 'foil' : '')
	}
};

export const manaboxModule: FormatModule = {
	format: manaboxFormat,
	detectFormat: (headers: string[]): number => {
		const headerSet = new Set(headers.map((h) => h.toLowerCase()));

		// Strong indicators for ManaBox
		const strongIndicators = [
			'manabox id',
			'binder name',
			'binder type',
			'purchase price currency'
		];

		// Common indicators
		const commonIndicators = [
			'quantity',
			'name',
			'set code',
			'collector number',
			'scryfall id',
			'set name',
			'rarity'
		];
		let score = 0;
		let strongMatches = 0;

		// Check strong indicators (highly weighted)
		for (const indicator of strongIndicators) {
			if (headerSet.has(indicator)) {
				strongMatches++;
				score += 0.3; // Each strong match is worth 30%
			}
		}

		// Check common indicators
		for (const indicator of commonIndicators) {
			if (headerSet.has(indicator)) {
				score += 0.05; // Each common match is worth 5%
			}
		}

		// If we have any strong indicators, this is likely ManaBox
		if (strongMatches > 0) {
			score += 0.2; // Bonus for having strong indicators
		}

		// Ensure score doesn't exceed 1.0
		return Math.min(score, 1.0);
	}
};
