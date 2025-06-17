import type { CsvFormat } from '../types.js';
import type { FormatModule } from './base.js';
import { createStandardFormatModule } from './format-helpers.js';

export const helvault: CsvFormat = {
	name: 'Helvault',
	id: 'helvault',
	description: 'Helvault collection export',
	hasHeaders: true,
	columnMappings: {
		count: 'quantity',
		name: 'name',
		edition: 'set_code',
		collectorNumber: 'collector_number',
		condition: 'condition',
		language: 'language',
		foil: 'foil'
	},
	transformations: {
		condition: (value: string) => value.trim(),
		language: (value: string) => value.trim(),
		foil: (value: string) =>
			value.toLowerCase() === 'true' || value.toLowerCase() === 'foil' ? 'foil' : ''
	}
};

export const helvaultModule: FormatModule = createStandardFormatModule(
	helvault,
	['set_code', 'collector_number'], // Strong indicators
	['quantity', 'name', 'condition', 'language', 'foil'],
	['quantity', 'name']
);
