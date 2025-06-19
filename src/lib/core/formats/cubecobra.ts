import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';
import { createStandardFormatModule } from '../../utils/format-helpers.js';

export const cubeCobra: CsvFormat = {
	name: 'CubeCobra',
	id: 'cubecobra',
	description: 'CubeCobra cube export',
	hasHeaders: true,
	columnMappings: {
		// CubeCobra doesn't have a count column - each row is 1 card
		// count: undefined, // Will default to 1 in converter
		name: 'name',
		edition: 'Set',
		collectorNumber: 'Collector Number',
		foil: 'Finish', // 'Foil' or empty
		notes: 'Notes',
		tags: 'tags',
		mtgoId: 'MTGO ID'
	},
	transformations: {
		foil: (value: string) => (value.toLowerCase() === 'foil' ? 'foil' : ''),
		notes: (value: string) => value.trim(),
		tags: (value: string) => value.trim()
	}
};

export const cubeCobraModule: FormatModule = createStandardFormatModule(
	cubeCobra,
	['status', 'maybeboard', 'Color Category'], // Strong indicators - unique to CubeCobra
	['name', 'Set', 'Collector Number', 'Rarity', 'Finish'],
	['name'] // Only name is required
);
