import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';
import { createStandardFormatModule } from '../../utils/format-helpers.js';

export const deckStats: CsvFormat = {
	name: 'DeckStats',
	id: 'deckstats',
	description: 'DeckStats deck export',
	hasHeaders: true,
	columnMappings: {
		count: 'amount',
		name: 'card_name',
		edition: 'set_code', // Use set_code as it's more standardized
		collectorNumber: 'collector_number',
		foil: 'is_foil',
		signed: 'is_signed',
		language: 'language',
		condition: 'condition',
		notes: 'comment'
	},
	transformations: {
		foil: (value: string) => (value.toLowerCase() === 'true' || value === '1' ? 'foil' : ''),
		signed: (value: string) => (value.toLowerCase() === 'true' || value === '1' ? 'TRUE' : 'FALSE'),
		condition: (value: string) => value.trim(),
		language: (value: string) => value.trim(),
		notes: (value: string) => value.trim()
	}
};

export const deckStatsModule: FormatModule = createStandardFormatModule(
	deckStats,
	['card_name', 'is_foil', 'is_pinned', 'is_signed'], // Strong indicators (underscore naming + unique fields)
	['amount', 'set_code', 'collector_number', 'language', 'condition'],
	['amount', 'card_name']
);
