import { describe, it, expect } from 'vitest';
import {
	createStandardFormatModule,
	parseEtchedFoil,
	cleanTCGPlayerCardName,
	parseTCGPlayerSellerCondition,
	parseDoubleFacedToken
} from '../../lib/utils/format-helpers.js';
import type { CsvFormat } from '../../lib/types.js';

describe('format-helpers', () => {
	describe('createStandardFormatModule', () => {
		const testFormat: CsvFormat = {
			name: 'Test Format',
			id: 'test',
			description: 'Test format',
			columnMappings: {},
			hasHeaders: true
		};

		it('should create a format module with correct format', () => {
			const module = createStandardFormatModule(testFormat);
			expect(module.format).toBe(testFormat);
		});

		it('should detect format based on strong indicators', () => {
			const module = createStandardFormatModule(testFormat, ['unique_header'], [], []);
			const headers = ['unique_header', 'card_name'];
			const score = module.detectFormat(headers);
			expect(score).toBeGreaterThan(0.5);
		});

		it('should require headers when specified', () => {
			const module = createStandardFormatModule(
				testFormat,
				['strong_indicator'],
				[],
				['required_header']
			);
			const headersWithoutRequired = ['card_name'];
			const headersWithRequired = ['required_header', 'strong_indicator'];

			expect(module.detectFormat(headersWithoutRequired)).toBe(0);
			expect(module.detectFormat(headersWithRequired)).toBeGreaterThan(0);
		});
	});

	describe('parseEtchedFoil', () => {
		it('should detect etched foil from archidekt format', () => {
			const result = parseEtchedFoil('archidekt', { Finish: 'Etched' });
			expect(result.isEtched).toBe(true);
		});

		it('should detect etched foil from cardsphere format', () => {
			const result = parseEtchedFoil('cardsphere', {}, 'NEO', 'Kamigawa: Neon Dynasty Etched Foil');
			expect(result.isEtched).toBe(true);
			expect(result.cleanedSetName).toBe('Kamigawa: Neon Dynasty');
		});

		it('should not detect etched when not present', () => {
			const result = parseEtchedFoil('archidekt', { Finish: 'Foil' });
			expect(result.isEtched).toBe(false);
		});

		it('should handle unknown formats', () => {
			const result = parseEtchedFoil('unknown', {});
			expect(result.isEtched).toBe(false);
		});
	});

	describe('cleanTCGPlayerCardName', () => {
		it('should remove variant suffixes', () => {
			expect(cleanTCGPlayerCardName('Lightning Bolt (Timeshifted)')).toBe('Lightning Bolt');
			expect(cleanTCGPlayerCardName('Birds of Paradise (Borderless)')).toBe('Birds of Paradise');
			expect(cleanTCGPlayerCardName('Counterspell (Retro Frame)')).toBe('Counterspell');
		});

		it('should handle multiple parentheses', () => {
			expect(cleanTCGPlayerCardName('Card Name (Showcase) (Foil Etched)')).toBe('Card Name');
		});

		it('should leave cards without variants unchanged', () => {
			expect(cleanTCGPlayerCardName('Lightning Bolt')).toBe('Lightning Bolt');
		});

		it('should handle edge cases', () => {
			expect(cleanTCGPlayerCardName('')).toBe('');
			expect(cleanTCGPlayerCardName('Card ()')).toBe('Card');
		});
	});

	describe('parseTCGPlayerSellerCondition', () => {
		it('should parse condition and foil status', () => {
			const result = parseTCGPlayerSellerCondition('Near Mint Foil');
			expect(result.condition).toBe('Near Mint');
			expect(result.foil).toBe('foil');
		});

		it('should handle condition without foil', () => {
			const result = parseTCGPlayerSellerCondition('Light Play');
			expect(result.condition).toBe('Light Play');
			expect(result.foil).toBe('');
		});

		it('should handle empty input', () => {
			const result = parseTCGPlayerSellerCondition('');
			expect(result.condition).toBe('');
			expect(result.foil).toBe('');
		});
	});

	describe('parseDoubleFacedToken', () => {
		it('should parse TCGPlayer seller format double-faced tokens', () => {
			const result = parseDoubleFacedToken(
				'Human (001) // Vampire (016) Double-Sided Token',
				'VOW'
			);
			expect(result.isDoubleFacedToken).toBe(true);
			expect(result.faces).toEqual([
				{ name: 'Human', collectorNumber: '001' },
				{ name: 'Vampire', collectorNumber: '016' }
			]);
			expect(result.adjustedSetCode).toBe('TVOW');
			expect(result.warnings).toContain(
				'Double-faced token detected - Scryfall may not handle these well, treating as separate entries'
			);
		});

		it('should parse TCGPlayer user format double-faced tokens', () => {
			const result = parseDoubleFacedToken('Illusion // Plant Double-sided Token');
			expect(result.isDoubleFacedToken).toBe(true);
			expect(result.faces).toEqual([{ name: 'Illusion' }, { name: 'Plant' }]);
		});

		it('should handle single-faced cards', () => {
			const result = parseDoubleFacedToken('Lightning Bolt');
			expect(result.isDoubleFacedToken).toBe(false);
		});

		it('should handle set code adjustments for tokens', () => {
			const result = parseDoubleFacedToken(
				'Human (001) // Vampire (016) Double-Sided Token',
				'VOW'
			);
			expect(result.adjustedSetCode).toBe('TVOW');
		});
	});
});
