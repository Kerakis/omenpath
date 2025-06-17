import type { CsvFormat } from '../types.js';
import type { FormatModule } from './base.js';
import { createStandardFormatModule } from './format-helpers.js';

export const cubeCobra: CsvFormat = {
	name: 'CubeCobra',
	id: 'cubecobra',
	description: 'CubeCobra cube export',
	hasHeaders: true,
	columnMappings: {
		count: 'count',
		name: 'name',
		edition: 'set',
		collectorNumber: 'collector_number',
		rarity: 'rarity',
		scryfallId: 'scryfall_id'
	},
	transformations: {
		rarity: (value: string) => value.toLowerCase().trim()
	}
};

export const cubeCobraModule: FormatModule = createStandardFormatModule(
	cubeCobra,
	['scryfall_id'], // Strong indicators
	['count', 'name', 'set', 'collector_number', 'rarity'], // Common indicators
	['count', 'name'] // Required headers
);
