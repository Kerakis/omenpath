import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';

// Utility functions for normalization
function normalizeCondition(value: string): string {
	if (!value) return 'Near Mint';
	const normalized = value.toLowerCase().trim().replace(/\s+/g, '');
	switch (normalized) {
		case 'mint':
			return 'Mint';
		case 'nearmint':
		case 'nearMint':
		case 'nm':
			return 'Near Mint';
		case 'excellent':
		case 'exc':
			return 'Near Mint'; // Map to closest standard condition
		case 'lightplayed':
		case 'lightlyplayed':
		case 'lightly played':
		case 'light played':
		case 'lp':
			return 'Lightly Played';
		case 'played':
		case 'pl':
			return 'Moderately Played'; // Map to closest standard condition
		case 'good':
		case 'gd':
			return 'Heavily Played'; // Map to closest standard condition
		case 'poor':
		case 'pr':
			return 'Damaged'; // Map to closest standard condition
		case 'heavily played':
		case 'heavilyplayed':
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

function normalizeFoil(value: string): string {
	if (!value) return '';
	const normalized = value.toLowerCase().trim();
	switch (normalized) {
		case 'foil':
			return 'foil';
		case 'etched':
			return 'etched';
		case 'normal':
		case 'nonfoil':
		case 'non-foil':
		default:
			return '';
	}
}

function normalizeLanguage(value: string): string {
	if (!value) return 'English';
	const normalized = value.toLowerCase().trim();
	switch (normalized) {
		case 'english':
		case 'en':
			return 'English';
		case 'japanese':
		case 'jp':
		case 'ja':
			return 'Japanese';
		case 'chinese':
		case 'cn':
		case 'zh':
			return 'Chinese';
		case 'french':
		case 'fr':
			return 'French';
		case 'german':
		case 'de':
			return 'German';
		case 'italian':
		case 'it':
			return 'Italian';
		case 'portuguese':
		case 'pt':
			return 'Portuguese';
		case 'russian':
		case 'ru':
			return 'Russian';
		case 'spanish':
		case 'es':
			return 'Spanish';
		case 'korean':
		case 'ko':
			return 'Korean';
		default:
			return value; // Return as-is if not recognized
	}
}

export const dragonShield: CsvFormat = {
	name: 'DragonShield',
	id: 'dragonshield',
	description: 'DragonShield collection export',
	hasHeaders: true,
	columnMappings: {
		count: 'Quantity',
		name: 'Card Name',
		edition: 'Set Code',
		editionName: 'Set Name',
		collectorNumber: 'Card Number',
		condition: 'Condition',
		language: 'Language',
		foil: 'Printing', // Maps to Normal/Foil/Etched
		purchasePrice: 'Price Bought'
	},
	transformations: {
		condition: normalizeCondition,
		language: normalizeLanguage,
		foil: normalizeFoil,
		name: (value: string) => {
			// Remove " Token" suffix for token cards
			if (value.endsWith(' Token')) {
				return value.slice(0, -6); // Remove " Token"
			}
			return value;
		},
		purchasePrice: (value: string) => {
			if (!value || value === '0' || value === '0.00') return '';
			return value.trim();
		}
	}
};

export const dragonShieldModule: FormatModule = {
	format: dragonShield,
	detectFormat: (headers: string[]): number => {
		const headerSet = new Set(headers.map((h) => h.toLowerCase()));

		// Check required headers first
		const requiredHeaders = ['quantity', 'card name'];
		const hasRequired = requiredHeaders.every((h) => headerSet.has(h));
		if (!hasRequired) return 0;

		let score = 0;
		let strongMatches = 0;

		// Check strong indicators (highly weighted - these should be unique to DragonShield)
		const strongIndicators = ['trade quantity', 'printing', 'price bought', 'date bought'];
		for (const indicator of strongIndicators) {
			if (headerSet.has(indicator)) {
				strongMatches++;
				score += 0.5;
			}
		}

		// Check common indicators (lower weight)
		const commonIndicators = ['folder name', 'low', 'mid', 'market', 'set name'];
		for (const indicator of commonIndicators) {
			if (headerSet.has(indicator)) {
				score += 0.05;
			}
		}

		// Big bonus for having multiple strong indicators
		if (strongMatches >= 3) {
			score += 0.8;
		} else if (strongMatches >= 2) {
			score += 0.4;
		} else if (strongMatches >= 1) {
			score += 0.2;
		}

		// Perfect match bonus
		if (strongIndicators.length > 0 && strongMatches === strongIndicators.length) {
			score += 0.5;
		}

		return Math.min(score, 1.0);
	},
	parseRow: (row: Record<string, string>, format: CsvFormat): Record<string, string> => {
		const result: Record<string, string> = {};

		// Apply standard column mappings first
		for (const [cardField, columnName] of Object.entries(format.columnMappings)) {
			if (columnName && row[columnName] !== undefined) {
				let value = row[columnName];

				// Apply transformations if they exist
				if (format.transformations && format.transformations[cardField]) {
					value = format.transformations[cardField](value);
				}

				result[cardField] = value;
			}
		}

		// Handle etched foils: remove "etc" suffix from card numbers and set codes
		if (result.collectorNumber && result.collectorNumber.endsWith('etc')) {
			result.collectorNumber = result.collectorNumber.slice(0, -3); // Remove "etc" suffix
		}

		// Special logic for set preference: Use Set Code if available, otherwise use Set Name
		// but mark it for fuzzy matching only when set code is empty or invalid
		let setCode = row['Set Code']?.trim();
		const setName = row['Set Name']?.trim();

		// Handle etched foils: remove "etc" suffix from set codes (though this is less common)
		if (setCode && setCode.endsWith('etc')) {
			setCode = setCode.slice(0, -3); // Remove "etc" suffix
		}

		if (setCode && setCode.length >= 2) {
			// Use set code as edition (preferred)
			result.edition = setCode;
			result.editionName = setName; // Keep set name for reference
		} else if (setName) {
			// Fall back to set name and mark for fuzzy matching
			result.edition = '';
			result.editionName = setName;
			result.needsFuzzySetMatching = 'true';
		}

		return result;
	}
};
