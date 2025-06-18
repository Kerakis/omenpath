import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';
import { createStandardFormatModule } from '../../utils/format-helpers.js';

export const deckedBuilder: CsvFormat = {
	name: 'Decked Builder',
	id: 'decked-builder',
	description: 'Decked Builder deck export',
	hasHeaders: true,
	columnMappings: {
		count: 'Count',
		name: 'Card',
		editionName: 'Set', // Full set name for fuzzy matching like DeckBox
		condition: 'Condition',
		foil: 'Foil'
	},
	transformations: {
		condition: (value: string) => value.trim(),
		foil: (value: string) =>
			value.toLowerCase() === 'true' || value.toLowerCase() === 'foil' ? 'foil' : ''
	}
};

export const deckedBuilderModule: FormatModule = createStandardFormatModule(
	deckedBuilder,
	[], // No strong indicators
	['Count', 'Card', 'Set', 'Condition', 'Foil'], // Common indicators
	['Count', 'Card'] // Required headers
);
