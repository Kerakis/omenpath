import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';
import { createStandardFormatModule } from '../../utils/format-helpers.js';

// Utility functions for normalization
function normalizeCondition(value: string): string {
	if (!value) return 'Near Mint';
	const normalized = value.toLowerCase().trim();
	switch (normalized) {
		case 'mint':
			return 'Mint';
		case 'nearmint':
		case 'near mint':
		case 'nm':
			return 'Near Mint';
		case 'excellent':
		case 'exc':
			return 'Near Mint'; // Map to closest standard condition
		case 'lightplayed':
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
		purchasePrice: (value: string) => {
			if (!value || value === '0' || value === '0.00') return '';
			return value.trim();
		}
	}
};

export const dragonShieldModule: FormatModule = createStandardFormatModule(
	dragonShield,
	['Trade Quantity', 'Printing', 'Price Bought', 'Date Bought'], // Strong indicators - unique combination
	['Folder Name', 'LOW', 'MID', 'MARKET', 'Set Name'],
	['Quantity', 'Card Name']
);
