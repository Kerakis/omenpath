import { describe, it, expect } from 'vitest';
import {
	createStandardFormatModule,
	parseEtchedFoil,
	cleanTCGPlayerCardName,
	parseTCGPlayerSellerCondition,
	parseDoubleFacedToken
} from '../../lib/utils/format-helpers.js';
import type { CsvFormat } from '../../lib/types.js';

import { describe, it, expect } from 'vitest';
import {
	parseEtchedFoil,
	cleanTCGPlayerCardName,
	parseTCGPlayerSellerCondition,
	parseDoubleFacedToken
} from '../../lib/utils/format-helpers.js';

describe('format-helpers', () => {
	describe('parseEtchedFoil', () => {
		it('should detect etched foil markers', () => {
			expect(parseEtchedFoil('etched', false)).toBe(true);
			expect(parseEtchedFoil('Etched', false)).toBe(true);
			expect(parseEtchedFoil('ETCHED', false)).toBe(true);
		});

		it('should not detect etched when not present', () => {
			expect(parseEtchedFoil('foil', false)).toBe(false);
			expect(parseEtchedFoil('normal', false)).toBe(false);
			expect(parseEtchedFoil('', false)).toBe(false);
		});

		it('should respect existing etched status', () => {
			expect(parseEtchedFoil('foil', true)).toBe(true);
			expect(parseEtchedFoil('normal', true)).toBe(true);
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
		it('should parse condition with quantity', () => {
			const result = parseTCGPlayerSellerCondition('Near Mint (15)');
			expect(result.condition).toBe('Near Mint');
			expect(result.quantity).toBe(15);
		});

		it('should handle condition without quantity', () => {
			const result = parseTCGPlayerSellerCondition('Light Play');
			expect(result.condition).toBe('Light Play');
			expect(result.quantity).toBe(1);
		});

		it('should handle malformed input', () => {
			const result = parseTCGPlayerSellerCondition('Near Mint (abc)');
			expect(result.condition).toBe('Near Mint');
			expect(result.quantity).toBe(1);
		});

		it('should handle empty input', () => {
			const result = parseTCGPlayerSellerCondition('');
			expect(result.condition).toBe('Near Mint');
			expect(result.quantity).toBe(1);
		});
	});

	describe('parseDoubleFacedToken', () => {
		it('should parse double-faced card names', () => {
			const result = parseDoubleFacedToken('Delver of Secrets // Insectile Aberration');
			expect(result.frontName).toBe('Delver of Secrets');
			expect(result.backName).toBe('Insectile Aberration');
			expect(result.isDoubleFaced).toBe(true);
		});

		it('should handle adventure cards', () => {
			const result = parseDoubleFacedToken('Bonecrusher Giant // Stomp');
			expect(result.frontName).toBe('Bonecrusher Giant');
			expect(result.backName).toBe('Stomp');
			expect(result.isDoubleFaced).toBe(true);
		});

		it('should handle single-faced cards', () => {
			const result = parseDoubleFacedToken('Lightning Bolt');
			expect(result.frontName).toBe('Lightning Bolt');
			expect(result.backName).toBe('');
			expect(result.isDoubleFaced).toBe(false);
		});

		it('should trim whitespace', () => {
			const result = parseDoubleFacedToken(' Delver of Secrets  //  Insectile Aberration ');
			expect(result.frontName).toBe('Delver of Secrets');
			expect(result.backName).toBe('Insectile Aberration');
		});
	});
});
