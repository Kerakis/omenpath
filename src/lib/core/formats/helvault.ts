import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';

// Helper function to parse Helvault extras field
export function parseHelvaultExtras(extras: string): {
	foil: string;
	proxy: string;
	signed: string;
	alter: string;
} {
	if (!extras) return { foil: '', proxy: 'FALSE', signed: 'FALSE', alter: 'FALSE' };

	const tags = extras
		.toLowerCase()
		.split('/')
		.map((tag) => tag.trim());

	// Check for foil status
	let foil = '';
	if (tags.includes('foil')) {
		foil = 'foil';
	} else if (tags.includes('etchedfoil')) {
		foil = 'etched';
	}

	// Check for user-generated tags (fuzzy matching)
	const isProxy = tags.some((tag) => tag.includes('proxy'));
	const isSigned = tags.some((tag) => tag.includes('signed'));
	const isAltered = tags.some(
		(tag) => tag.includes('altered') || tag.includes('alteredart') || tag.includes('alter')
	);

	return {
		foil,
		proxy: isProxy ? 'TRUE' : 'FALSE',
		signed: isSigned ? 'TRUE' : 'FALSE',
		alter: isAltered ? 'TRUE' : 'FALSE'
	};
}

export const helvault: CsvFormat = {
	name: 'Helvault',
	id: 'helvault',
	description: 'Helvault collection export',
	hasHeaders: true,
	columnMappings: {
		cmc: 'cmc',
		collectorNumber: 'collector_number',
		colorIdentity: 'color_identity',
		colors: 'colors',
		estimatedPrice: 'estimated_price',
		extras: 'extras',
		language: 'language',
		manaCost: 'mana_cost',
		name: 'name',
		oracleId: 'oracle_id',
		count: 'quantity',
		rarity: 'rarity',
		scryfallId: 'scryfall_id',
		edition: 'set_code',
		editionName: 'set_name',
		typeLine: 'type_line'
	},
	transformations: {
		language: (value: string) => value.trim()
		// Note: extras field parsing is handled in the card parsing logic
	}
};

export const helvaultModule: FormatModule = {
	format: helvault,
	detectFormat: (headers: string[]): number => {
		const headerSet = new Set(headers.map((h) => h.toLowerCase()));

		// Strong indicators: Helvault uses underscore format extensively
		const underscoreHeaders = [
			'collector_number',
			'color_identity',
			'estimated_price',
			'mana_cost',
			'oracle_id',
			'scryfall_id',
			'set_code',
			'set_name',
			'type_line'
		];

		let underscoreMatches = 0;
		for (const header of underscoreHeaders) {
			if (headerSet.has(header)) {
				underscoreMatches++;
			}
		}

		// If we have 3+ underscore headers, very likely Helvault
		if (underscoreMatches >= 3) {
			return 90;
		}

		// Check for specific Helvault combination
		const requiredHeaders = ['name', 'quantity', 'set_code'];
		const hasRequired = requiredHeaders.every((header) => headerSet.has(header));

		if (hasRequired && underscoreMatches >= 1) {
			return 70;
		}

		return 0;
	}
};
