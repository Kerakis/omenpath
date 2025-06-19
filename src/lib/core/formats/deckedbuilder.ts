import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';
import { createStandardFormatModule } from '../../utils/format-helpers.js';

export const deckedBuilder: CsvFormat = {
	name: 'Decked Builder',
	id: 'decked-builder',
	description: 'Decked Builder deck export',
	hasHeaders: true,
	columnMappings: {
		count: 'Total Qty', // Total quantity of the card
		name: 'Card',
		editionName: 'Set' // Full set name for fuzzy matching
		// Note: No condition column in Decked Builder exports
		// Note: Foil handling is via separate Reg Qty and Foil Qty columns
	},
	transformations: {
		// Decked Builder has separate Regular and Foil quantity columns
		// The converter engine will need to handle this during parsing
	}
};

export const deckedBuilderModule: FormatModule = createStandardFormatModule(
	deckedBuilder,
	['Total Qty', 'Reg Qty', 'Foil Qty'], // Strong indicators - unique combination of quantity columns
	['Card', 'Set', 'Mana Cost', 'Card Type', 'Color', 'Rarity', 'Mvid'],
	['Total Qty', 'Card'] // Required headers
);
