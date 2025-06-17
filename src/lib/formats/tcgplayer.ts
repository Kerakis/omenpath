import type { CsvFormat } from '../types.js';
import type { FormatModule } from './base.js';
import { createStandardFormatModule } from './format-helpers.js';

export const tcgPlayer: CsvFormat = {
	name: 'TCGPlayer',
	id: 'tcgplayer',
	description: 'TCGPlayer collection export',
	hasHeaders: true,
	columnMappings: {
		count: 'Quantity',
		name: 'Simple Name',
		edition: 'Set Name',
		condition: 'Condition',
		foil: 'Printing'
	},
	transformations: {
		condition: (value: string) => value.trim(),
		foil: (value: string) => (value.toLowerCase() === 'foil' ? 'foil' : '')
	}
};

export const tcgPlayerModule: FormatModule = createStandardFormatModule(
	tcgPlayer,
	['Simple Name', 'Set Name', 'Printing'], // Strong indicators
	['Quantity', 'Condition'],
	['Quantity', 'Simple Name']
);
