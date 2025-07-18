import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';

export const mtgo: CsvFormat = {
	name: 'MTGO',
	id: 'mtgo',
	description: 'Magic: The Gathering Online collection export (CSV and DEK formats)',
	hasHeaders: true,
	columnMappings: {
		name: 'Card Name',
		count: 'Quantity',
		mtgoId: 'ID #',
		rarity: 'Rarity',
		edition: 'Set',
		collectorNumber: 'Collector #',
		foil: 'Premium',
		annotation: 'Annotation'
	},
	transformations: {
		foil: (value: string) =>
			value.toLowerCase() === 'yes' || value.toLowerCase() === 'true' ? 'foil' : '',
		count: (value: string) => value || '1',
		collectorNumber: (value: string) => {
			// MTGO format includes collector numbers as "number/total" (e.g., "1/205")
			// Extract just the number part for compatibility with Scryfall
			if (value && value.includes('/')) {
				const parts = value.split('/');
				const numberPart = parts[0].trim();
				// Handle cases where the number part might be empty (e.g., "/1158")
				return numberPart || '';
			}
			return value || '';
		}
	}
};

export const mtgoModule: FormatModule = {
	format: mtgo,
	detectFormat: (headers: string[]): number => {
		const headerSet = new Set(headers.map((h) => h.toLowerCase()));

		// Primary indicator: "ID #" column is unique to MTGO CSV format
		if (headerSet.has('id #')) {
			return 100; // 100% confidence
		}

		// Check for other MTGO-specific patterns
		const mtgoPatterns = [
			['card name', 'quantity', 'rarity', 'set'],
			['card name', 'quantity', 'premium']
		];

		for (const pattern of mtgoPatterns) {
			const matches = pattern.filter((header) => headerSet.has(header)).length;
			if (matches === pattern.length) {
				return 70; // High confidence
			}
		}

		return 0;
	}
};
