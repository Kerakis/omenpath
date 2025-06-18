import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';
import { createStandardFormatModule } from '../../utils/format-helpers.js';

export const dragonShield: CsvFormat = {
	name: 'DragonShield',
	id: 'dragonshield',
	description: 'DragonShield collection export',
	hasHeaders: true,
	columnMappings: {
		count: 'Quantity',
		name: 'Card Name',
		edition: 'Set Code',
		collectorNumber: 'Card Number',
		condition: 'Condition',
		language: 'Language',
		foil: 'Foiling'
	},
	transformations: {
		condition: (value: string) => value.trim(),
		language: (value: string) => value.trim(),
		foil: (value: string) => (value.toLowerCase() === 'foil' ? 'foil' : '')
	}
};

export const dragonShieldModule: FormatModule = createStandardFormatModule(
	dragonShield,
	['Foiling', 'Set Code'], // Strong indicators
	['Quantity', 'Card Name', 'Card Number', 'Condition', 'Language'],
	['Quantity', 'Card Name']
);
