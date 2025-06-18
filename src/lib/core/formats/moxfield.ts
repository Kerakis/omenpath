import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';
import { createStandardFormatModule } from '../../utils/format-helpers.js';

export const moxfield: CsvFormat = {
	name: 'Moxfield',
	id: 'moxfield',
	description: 'Moxfield collection export',
	hasHeaders: true,
	columnMappings: {
		count: 'Quantity',
		name: 'Name',
		edition: 'Edition',
		collectorNumber: 'Collector Number',
		condition: 'Condition',
		foil: 'Foil',
		scryfallId: 'Scryfall ID'
	},
	transformations: {
		condition: (value: string) => value.trim(),
		foil: (value: string) =>
			value.toLowerCase() === 'true' || value.toLowerCase() === 'foil' ? 'foil' : ''
	}
};

export const moxfieldModule: FormatModule = createStandardFormatModule(
	moxfield,
	['Scryfall ID', 'Edition'], // Strong indicators
	['Quantity', 'Name', 'Collector Number', 'Condition', 'Foil'],
	['Quantity', 'Name']
);
