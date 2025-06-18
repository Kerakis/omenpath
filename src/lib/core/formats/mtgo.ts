import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';
import { createStandardFormatModule } from '../../utils/format-helpers.js';

export const mtgo: CsvFormat = {
	name: 'MTGO (.csv)',
	id: 'mtgo',
	description: 'Magic: The Gathering Online collection export',
	hasHeaders: true,
	columnMappings: {
		count: 'Qty',
		name: 'Card Name',
		edition: 'Set',
		foil: 'Premium'
	},
	transformations: {
		foil: (value: string) =>
			value.toLowerCase() === 'yes' || value.toLowerCase() === 'true' ? 'foil' : ''
	}
};

export const mtgoModule: FormatModule = createStandardFormatModule(
	mtgo,
	['Premium'], // Strong indicator
	['Qty', 'Card Name', 'Set'],
	['Qty', 'Card Name']
);
