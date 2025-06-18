import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';

export const cardsphere: CsvFormat = {
	name: 'Cardsphere',
	id: 'cardsphere',
	description: 'Cardsphere collection export',
	hasHeaders: true,
	columnMappings: {
		count: 'Quantity',
		name: 'Name',
		edition: 'Set',
		condition: 'Condition',
		language: 'Language',
		foil: 'Foil',
		collectorNumber: 'Collector Number',
		rarity: 'Rarity',
		scryfallId: 'Scryfall ID'
	},
	transformations: {
		condition: (value: string) => value.trim(),
		language: (value: string) => value.trim(),
		foil: (value: string) =>
			value.toLowerCase() === 'true' || value.toLowerCase() === 'foil' ? 'foil' : '',
		rarity: (value: string) => value.toLowerCase().trim()
	}
};

export const cardsphereModule: FormatModule = {
	format: cardsphere,
	detectFormat: (headers: string[]): number => {
		const headerSet = new Set(headers.map((h) => h.toLowerCase()));
		const indicators = [
			'quantity',
			'name',
			'set',
			'condition',
			'language',
			'foil',
			'collector number',
			'rarity',
			'scryfall id'
		];

		let matches = 0;
		for (const indicator of indicators) {
			if (headerSet.has(indicator)) {
				matches++;
			}
		}

		// Need at least basic headers to be confident
		const requiredHeaders = ['quantity', 'name', 'set'];
		const hasRequired = requiredHeaders.every((h) => headerSet.has(h));

		if (!hasRequired) return 0;

		return Math.min(matches / indicators.length, 1.0);
	}
};
