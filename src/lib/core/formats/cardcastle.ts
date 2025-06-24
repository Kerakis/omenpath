import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';

// CardCastle (Full) - with JSON IDs
export const cardCastleFull: CsvFormat = {
	name: 'CardCastle (Full)',
	id: 'cardcastle-full',
	description: 'CardCastle full CSV export with JSON ID (Scryfall ID)',
	hasHeaders: true,
	columnMappings: {
		name: 'Card Name',
		editionName: 'Set Name',
		condition: 'Condition',
		foil: 'Foil',
		language: 'Language',
		multiverseId: 'Multiverse ID',
		jsonId: 'JSON ID', // This is the Scryfall ID with potential extra 0 for DFCs
		purchasePrice: 'Price USD'
	},
	transformations: {
		condition: (value: string) => value.trim(),
		language: (value: string) => value.trim(),
		foil: (value: string) =>
			value.toLowerCase() === 'true' || value.toLowerCase() === 'foil' ? 'foil' : '',
		jsonId: (value: string) => {
			// Handle dual-faced card issue - remove trailing 0 if present
			if (value && value.length > 36 && value.endsWith('0')) {
				return value.slice(0, -1);
			}
			return value;
		}
	}
};

// CardCastle (Simple) - without JSON IDs
export const cardCastleSimple: CsvFormat = {
	name: 'CardCastle (Simple)',
	id: 'cardcastle-simple',
	description: 'CardCastle simple CSV export without JSON ID',
	hasHeaders: true,
	columnMappings: {
		count: 'Count',
		name: 'Card Name',
		editionName: 'Set Name',
		collectorNumber: 'Collector Number',
		foil: 'Foil'
	},
	transformations: {
		condition: (value: string) => value.trim(),
		language: (value: string) => value.trim(),
		foil: (value: string) =>
			value.toLowerCase() === 'true' || value.toLowerCase() === 'yes' ? 'foil' : ''
	}
};

export const cardCastleFullModule: FormatModule = {
	format: cardCastleFull,
	detectFormat: (headers: string[]): number => {
		const headerSet = new Set(headers.map((h) => h.toLowerCase()));

		// Primary indicator: "JSON ID" is unique to CardCastle
		if (headerSet.has('json id')) {
			return 1.0; // 100% confidence
		}

		// Secondary indicators for CardCastle Full
		const cardCastlePattern = ['card name', 'set name', 'multiverse id'];
		const matches = cardCastlePattern.filter((header) => headerSet.has(header)).length;

		if (matches >= 2) {
			return 0.7; // High confidence
		}

		return 0;
	}
};

export const cardCastleSimpleModule: FormatModule = {
	format: cardCastleSimple,
	detectFormat: (headers: string[]): number => {
		const headerSet = new Set(headers.map((h) => h.toLowerCase()));

		// Should not have JSON ID for simple version
		if (headerSet.has('json id')) {
			return 0;
		}

		// Check for CardCastle Simple pattern
		const simplePattern = ['count', 'card name', 'set name', 'collector number', 'foil'];
		const matches = simplePattern.filter((header) => headerSet.has(header)).length;

		if (matches >= 4) {
			return 0.8; // High confidence
		}

		return 0;
	}
};

export const cardCastleFormats = [cardCastleFull, cardCastleSimple];
export const cardCastleModules = [cardCastleFullModule, cardCastleSimpleModule];
