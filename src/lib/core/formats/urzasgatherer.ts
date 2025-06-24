import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';

// Utility functions for normalization
function normalizeCondition(value: string): string {
	if (!value) return 'Near Mint';
	const normalized = value.toLowerCase().trim();
	switch (normalized) {
		case 'mint':
		case 'm':
			return 'Mint';
		case 'near mint':
		case 'nm':
		case 'near-mint':
			return 'Near Mint';
		case 'lightly played':
		case 'light played':
		case 'slightly played':
		case 'lp':
		case 'sp':
			return 'Lightly Played';
		case 'moderately played':
		case 'mp':
			return 'Moderately Played';
		case 'heavily played':
		case 'hp':
			return 'Heavily Played';
		case 'damaged':
		case 'dmg':
		case 'd':
			return 'Damaged';
		default:
			return 'Near Mint';
	}
}

export const urzasGatherer: CsvFormat = {
	name: "Urza's Gatherer",
	id: 'urzas-gatherer',
	description: "Urza's Gatherer collection export",
	hasHeaders: true,
	columnMappings: {
		count: 'Count',
		name: 'Name',
		edition: 'Set', // Full set name
		collectorNumber: 'Number',
		condition: 'Condition',
		language: 'Languages',
		notes: 'Comments',
		multiverseId: 'Multiverse ID',
		foilCount: 'Foil count',
		specialFoilCount: 'Special foil count', // Etched foils
		scryfallId: 'Scryfall ID'
	},
	transformations: {
		condition: normalizeCondition,
		language: (value: string) => value.trim(),
		notes: (value: string) => value.trim()
	}
};

export const urzasGathererModule: FormatModule = {
	format: urzasGatherer,
	detectFormat: (headers: string[]): number => {
		const headerSet = new Set(headers.map((h) => h.toLowerCase()));

		// Check required headers first
		const requiredHeaders = ['count', 'name'];
		const hasRequired = requiredHeaders.every((h) => headerSet.has(h));
		if (!hasRequired) return 0;

		let score = 0;
		let strongMatches = 0;

		// Check strong indicators (highly weighted - unique to Urza's Gatherer)
		const strongIndicators = ['foil count', 'special foil count', 'tcg id', 'cardmarket id'];
		for (const indicator of strongIndicators) {
			if (headerSet.has(indicator)) {
				strongMatches++;
				score += 0.5;
			}
		}

		// Check common indicators (lower weight)
		const commonIndicators = [
			'name',
			'type',
			'color',
			'rarity',
			'author',
			'power',
			'toughness',
			'mana cost',
			'converted mana cost'
		];
		for (const indicator of commonIndicators) {
			if (headerSet.has(indicator)) {
				score += 0.05;
			}
		}

		// Big bonus for having multiple strong indicators
		if (strongMatches >= 3) {
			score += 0.8;
		} else if (strongMatches >= 2) {
			score += 0.4;
		} else if (strongMatches >= 1) {
			score += 0.2;
		}

		// Perfect match bonus
		if (strongIndicators.length > 0 && strongMatches === strongIndicators.length) {
			score += 0.5;
		}

		return Math.min(score, 1.0);
	},
	parseRow: (row: Record<string, string>, format: CsvFormat): Record<string, string> => {
		const result: Record<string, string> = {};

		// Apply standard column mappings first
		for (const [cardField, columnName] of Object.entries(format.columnMappings)) {
			if (columnName && row[columnName] !== undefined) {
				let value = row[columnName];

				// Apply transformations if they exist
				if (format.transformations && format.transformations[cardField]) {
					value = format.transformations[cardField](value);
				}

				result[cardField] = value;
			}
		}

		// Special logic for UrzaGatherer: Trust IDs unless name mismatch
		// The 'Set' column contains set names, not codes, but we have reliable IDs
		const scryfallId = row['Scryfall ID']?.trim();
		const multiverseId = row['Multiverse ID']?.trim();

		if (scryfallId || multiverseId) {
			// We have reliable ID data, so trust it and skip set matching issues
			// Only validate against name for obvious mismatches
			result.trustIds = 'true';
			result.skipSetValidation = 'true';
		}

		// Handle the Set column which contains set names, not codes
		const setName = row['Set']?.trim();
		if (setName) {
			result.editionName = setName;
			result.edition = ''; // Clear edition since we don't have set codes
			// Mark for fuzzy matching if we don't have IDs
			if (!scryfallId && !multiverseId) {
				result.needsFuzzySetMatching = 'true';
			}
		}

		return result;
	}
};
