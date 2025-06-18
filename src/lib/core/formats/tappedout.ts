import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';
import { createStandardFormatModule } from '../../utils/format-helpers.js';

export const tappedOut: CsvFormat = {
	name: 'TappedOut',
	id: 'tappedout',
	description: 'TappedOut deck export',
	hasHeaders: true,
	columnMappings: {
		count: 'Qty',
		name: 'Name',
		edition: 'Set',
		condition: 'Condition',
		foil: 'Foil'
	},
	transformations: {
		condition: (value: string) => value.trim(),
		foil: (value: string) =>
			value.toLowerCase() === 'true' || value.toLowerCase() === 'foil' ? 'foil' : ''
	}
};

export const tappedOutModule: FormatModule = createStandardFormatModule(
	tappedOut,
	[], // No strong indicators
	['Qty', 'Name', 'Set', 'Condition', 'Foil'],
	['Qty', 'Name']
);
