import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';

export const tappedOut: CsvFormat = {
	name: 'TappedOut',
	id: 'tappedout',
	description: 'TappedOut inventory export',
	hasHeaders: true,
	columnMappings: {
		count: 'Qty',
		name: 'Name',
		edition: 'Set',
		collectorNumber: 'Set Number',
		foil: 'Foil',
		alter: 'Alter',
		signed: 'Signed',
		condition: 'Condition',
		language: 'Languange', // Note: TappedOut misspells this
		proxy: 'Proxy'
	},
	transformations: {
		condition: (value: string) => value.trim(),
		foil: (value: string) => {
			if (value === '-') return 'FALSE';
			return value.toLowerCase() === 'true' || value.toLowerCase() === 'foil' || value === 'f'
				? 'foil'
				: '';
		},
		alter: (value: string) => (value === '-' ? 'FALSE' : 'TRUE'),
		signed: (value: string) => (value === '-' ? 'FALSE' : 'TRUE'),
		proxy: (value: string) => (value === '-' ? 'FALSE' : 'TRUE')
	}
};

export const tappedOutModule: FormatModule = {
	format: tappedOut,
	detectFormat: (headers: string[]): number => {
		const headerSet = new Set(headers.map((h) => h.toLowerCase()));

		// Strong indicators unique to TappedOut
		const strongIndicators = [
			'languange', // Misspelled language column is unique to TappedOut
			'set number' // TappedOut uses "Set Number" instead of "Collector Number"
		];

		let score = 0;

		// Check for strong indicators
		for (const indicator of strongIndicators) {
			if (headerSet.has(indicator)) {
				score += 40; // High weight for unique indicators
			}
		}

		// Check for TappedOut pattern: Qty + Name + Set combination
		if (headerSet.has('qty') && headerSet.has('name') && headerSet.has('set')) {
			score += 30;
		}

		// Additional TappedOut-specific columns
		const tappedOutColumns = ['alter', 'signed', 'proxy'];
		const tappedOutMatches = tappedOutColumns.filter((col) => headerSet.has(col)).length;
		score += tappedOutMatches * 10;

		return Math.min(score, 100);
	}
};
