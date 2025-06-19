import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';
import { createStandardFormatModule } from '../../utils/format-helpers.js';

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

export const urzasGatherer: CsvFormat = {
	name: "Urza's Gatherer",
	id: 'urzas-gatherer',
	description: "Urza's Gatherer collection export",
	hasHeaders: true,
	columnMappings: {
		count: 'Count',
		name: 'Name',
		edition: 'Set', // Full set name
		collectorNumber: 'Number',
		condition: 'Condition',
		language: 'Languages',
		notes: 'Comments',
		multiverseId: 'Multiverse ID',
		foilCount: 'Foil count',
		specialFoilCount: 'Special foil count', // Etched foils
		scryfallId: 'Scryfall ID'
	},
	transformations: {
		condition: normalizeCondition,
		language: (value: string) => value.trim(),
		notes: (value: string) => value.trim()
	}
};

export const urzasGathererModule: FormatModule = createStandardFormatModule(
	urzasGatherer,
	['Foil count', 'Special foil count', 'TCG ID', 'Cardmarket ID'], // Strong indicators - unique to Urza's Gatherer
	[
		'Name',
		'Type',
		'Color',
		'Rarity',
		'Author',
		'Power',
		'Toughness',
		'Mana cost',
		'Converted mana cost'
	],
	['Count', 'Name']
);
