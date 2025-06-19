import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';
import { createStandardFormatModule } from '../../utils/format-helpers.js';

export const moxfield: CsvFormat = {
	name: 'Moxfield',
	id: 'moxfield',
	description: 'Moxfield collection export',
	hasHeaders: true,
	columnMappings: {
		count: 'Count',
		tradelistCount: 'Tradelist Count',
		name: 'Name',
		edition: 'Edition',
		condition: 'Condition',
		language: 'Language',
		foil: 'Foil',
		tags: 'Tags',
		lastModified: 'Last Modified',
		collectorNumber: 'Collector Number',
		alter: 'Alter',
		proxy: 'Proxy',
		purchasePrice: 'Purchase Price'
	},
	transformations: {
		condition: (value: string) => value.trim(),
		foil: (value: string) =>
			value.toLowerCase() === 'true' || value.toLowerCase() === 'foil' ? 'foil' : '',
		alter: (value: string) =>
			value.toLowerCase() === 'true' || value.toLowerCase() === 'yes' ? 'TRUE' : 'FALSE',
		proxy: (value: string) =>
			value.toLowerCase() === 'true' || value.toLowerCase() === 'yes' ? 'TRUE' : 'FALSE'
	}
};

export const moxfieldModule: FormatModule = createStandardFormatModule(
	moxfield,
	['Alter', 'Proxy'], // Strong indicators - these are unique to Moxfield among formats with "Tradelist Count"
	['Tradelist Count', 'Last Modified', 'Purchase Price'],
	['Count', 'Name']
);
