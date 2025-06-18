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
		edition: 'set_name',
		foil: 'is_foil'
	},
	transformations: {
		foil: (value: string) => (value.toLowerCase() === 'true' || value === '1' ? 'foil' : '')
	}
};

export const deckStatsModule: FormatModule = createStandardFormatModule(
	deckStats,
	['card_name', 'set_name', 'is_foil'], // Strong indicators (underscore naming)
	['amount'],
	['amount', 'card_name']
);
