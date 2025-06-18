import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';
import { createStandardFormatModule } from '../../utils/format-helpers.js';

export const delverLens: CsvFormat = {
	name: 'DelverLens',
	id: 'delverlens',
	description: 'DelverLens collection export',
	hasHeaders: true,
	columnMappings: {
		count: 'Quantity',
		name: 'Name',
		edition: 'Set',
		collectorNumber: 'Card Number',
		condition: 'Condition',
		language: 'Language',
		foil: 'Finish'
	},
	transformations: {
		condition: (value: string) => value.trim(),
		language: (value: string) => value.trim(),
		foil: (value: string) => (value.toLowerCase() === 'foil' ? 'foil' : '')
	}
};

export const delverLensModule: FormatModule = createStandardFormatModule(
	delverLens,
	['Finish'], // Strong indicator
	['Quantity', 'Name', 'Set', 'Card Number', 'Condition', 'Language'],
	['Quantity', 'Name']
);
