import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';

// CardCastle (Full) - with Scryfall IDs
export const cardCastleFull: CsvFormat = {
	name: 'CardCastle (Full)',
	id: 'cardcastle-full',
	description: 'CardCastle CSV with Scryfall IDs (recommended over Simple version for accuracy)',
	hasHeaders: true,
	columnMappings: {
		count: 'Quantity',
		name: 'Card Name',
		edition: 'Set',
		collectorNumber: 'Card Number',
		condition: 'Condition',
		language: 'Language',
		foil: 'Foil',
		purchasePrice: 'Purchase Price',
		scryfallId: 'scryfall_id'
	},
	transformations: {
		condition: (value: string) => value.trim(),
		language: (value: string) => value.trim(),
		foil: (value: string) =>
			value.toLowerCase() === 'true' || value.toLowerCase() === 'yes' ? 'foil' : '',
		purchasePrice: (value: string) => {
			// Remove currency symbols and parse
			const cleaned = value.replace(/[$,]/g, '');
			const num = parseFloat(cleaned);
			return isNaN(num) ? '' : num.toString();
		}
	}
};

// CardCastle (Simple) - without Scryfall IDs
export const cardCastleSimple: CsvFormat = {
	name: 'CardCastle (Simple)',
	id: 'cardcastle-simple',
	description: 'CardCastle CSV without Scryfall IDs (less accurate but more compatible)',
	hasHeaders: true,
	columnMappings: {
		count: 'Quantity',
		name: 'Card Name',
		edition: 'Set',
		collectorNumber: 'Card Number',
		condition: 'Condition',
		language: 'Language',
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

		// Strong indicators for CardCastle Full
		const strongIndicators = ['scryfall_id'];

		// Common CardCastle indicators
		const commonIndicators = [
			'quantity',
			'card name',
			'set',
			'card number',
			'condition',
			'language',
			'foil',
			'purchase price'
		];

		let score = 0;
		let strongMatches = 0;

		for (const indicator of strongIndicators) {
			if (headerSet.has(indicator)) {
				strongMatches++;
				score += 0.4;
			}
		}

		for (const indicator of commonIndicators) {
			if (headerSet.has(indicator)) {
				score += 0.08;
			}
		}

		if (strongMatches > 0) {
			score += 0.2;
		}

		return Math.min(score, 1.0);
	}
};

export const cardCastleSimpleModule: FormatModule = {
	format: cardCastleSimple,
	detectFormat: (headers: string[]): number => {
		const headerSet = new Set(headers.map((h) => h.toLowerCase()));

		// CardCastle Simple should only match if Full doesn't match better
		const indicators = [
			'quantity',
			'card name',
			'set',
			'card number',
			'condition',
			'language',
			'foil'
		];

		let score = 0;

		// Should not have scryfall_id for simple version
		if (headerSet.has('scryfall_id')) {
			return 0;
		}

		for (const indicator of indicators) {
			if (headerSet.has(indicator)) {
				score += 0.1;
			}
		}

		return Math.min(score, 0.8); // Cap at 0.8 to prefer Full version when available
	}
};

export const cardCastleFormats = [cardCastleFull, cardCastleSimple];
export const cardCastleModules = [cardCastleFullModule, cardCastleSimpleModule];
