import type { CsvFormat } from '../types.js';
import type { FormatModule } from './base.js';
import { createStandardFormatModule } from './format-helpers.js';

// Generic CSV format for testing or when format detection fails
export const genericCsv: CsvFormat = {
	name: 'Generic CSV',
	id: 'generic',
	description: 'Generic CSV format with common column names',
	hasHeaders: true,
	columnMappings: {
		count: 'Quantity',
		name: 'Name', // Will also try 'Card Name', 'Card'
		edition: 'Set',
		collectorNumber: 'Collector Number',
		condition: 'Condition',
		language: 'Language',
		foil: 'Foil'
	},
	transformations: {
		condition: (value: string) => value.trim(),
		language: (value: string) => value.trim(),
		foil: (value: string) =>
			value.toLowerCase() === 'true' || value.toLowerCase() === 'foil' ? 'foil' : ''
	}
};

// Simple test format for basic CSV files
export const simpleTestFormat: CsvFormat = {
	name: 'Simple Test Format',
	id: 'simple-test',
	description: 'Simple test format for basic CSV files',
	hasHeaders: true,
	columnMappings: {
		count: 'Quantity',
		name: 'Name',
		editionName: 'Set' // Uses editionName to trigger fuzzy matching
	}
};

export const genericCsvModule: FormatModule = createStandardFormatModule(
	genericCsv,
	[], // No strong indicators - this is fallback
	['Quantity', 'Name', 'Set', 'Collector Number', 'Condition', 'Language', 'Foil'],
	['Name'] // Only requires name
);

export const simpleTestModule: FormatModule = createStandardFormatModule(
	simpleTestFormat,
	[], // No strong indicators
	['Quantity', 'Name', 'Set'],
	['Name']
);
