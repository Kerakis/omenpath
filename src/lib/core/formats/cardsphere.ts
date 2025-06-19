import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';

export const cardsphere: CsvFormat = {
	name: 'Cardsphere',
	id: 'cardsphere',
	description: 'Cardsphere collection export',
	hasHeaders: true,
	columnMappings: {
		count: 'Count',
		tradelistCount: 'Tradelist Count',
		name: 'Name',
		edition: 'Edition',
		condition: 'Condition',
		language: 'Language',
		foil: 'Foil',
		tags: 'Tags',
		scryfallId: 'Scryfall ID',
		lastModified: 'Last Modified'
	},
	transformations: {
		condition: (value: string) => value.trim(),
		language: (value: string) => value.trim(),
		foil: (value: string) =>
			value.toLowerCase() === 'true' || value.toLowerCase() === 'foil' ? 'foil' : ''
	}
};

export const cardsphereModule: FormatModule = {
	format: cardsphere,
	detectFormat: (headers: string[]): number => {
		const headerSet = new Set(headers.map((h) => h.toLowerCase()));

		// Strong indicator: Scryfall ID column (unique among formats with "Tradelist Count")
		if (headerSet.has('scryfall id')) {
			// Check for Tradelist Count + Scryfall ID combination (strong Cardsphere indicator)
			if (headerSet.has('tradelist count')) {
				return 0.9; // Very high confidence
			}
			return 0.7; // High confidence
		}

		// If no Scryfall ID, check for other patterns
		const requiredHeaders = ['count', 'tradelist count', 'name', 'edition'];
		const matches = requiredHeaders.filter((header) => headerSet.has(header)).length;

		if (matches >= 3) {
			return 0.5; // Medium confidence
		}

		return 0;
	}
};
