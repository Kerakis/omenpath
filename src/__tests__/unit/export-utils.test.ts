import { describe, it, expect } from 'vitest';
import { getOriginalCsvLine } from '../../lib/utils/conversion/export-utils.js';
import type { ConversionResult, ParsedCard } from '../../lib/types.js';

describe('export-utils integration', () => {
	it('should extract original CSV line from conversion result', () => {
		const mockParsedCard: ParsedCard = {
			originalData: {
				Count: '4',
				Name: 'Lightning Bolt',
				Edition: 'Fourth Edition',
				Condition: 'Near Mint',
				Language: 'English',
				Foil: '',
				Tags: 'Burn',
				'Last Modified': '2024-01-01',
				'Collector Number': '1',
				Alter: '',
				Proxy: '',
				'Purchase Price': '$10.00'
			},
			count: 4,
			name: 'Lightning Bolt',
			edition: 'fourth edition',
			condition: 'Near Mint',
			language: 'English',
			needsLookup: true
		};

		const mockResult: ConversionResult = {
			success: true,
			confidence: 'high',
			originalCard: mockParsedCard,
			identificationMethod: 'name_set',
			moxfieldRow: {}
		};

		const csvLine = getOriginalCsvLine(mockResult);

		expect(csvLine).toContain('4,Lightning Bolt,Fourth Edition');
		expect(csvLine).toContain('Near Mint,English');
		expect(csvLine).toContain('$10.00');
	});

	it('should handle missing data gracefully', () => {
		const mockParsedCard: ParsedCard = {
			originalData: {
				Name: 'Test Card'
			},
			count: 1,
			name: 'Test Card',
			needsLookup: true
		};

		const mockResult: ConversionResult = {
			success: false,
			error: 'Test error',
			confidence: 'low',
			originalCard: mockParsedCard,
			identificationMethod: 'failed',
			moxfieldRow: {}
		};

		const csvLine = getOriginalCsvLine(mockResult);

		expect(csvLine).toContain('Test Card');
		expect(csvLine).toBeDefined();
		expect(csvLine.length).toBeGreaterThan(0);
	});

	it('should preserve original CSV field order', () => {
		const mockParsedCard: ParsedCard = {
			originalData: {
				Count: '1',
				Name: 'Test Card',
				Set: 'Test Set',
				Rarity: 'Common'
			},
			count: 1,
			name: 'Test Card',
			needsLookup: true
		};

		const mockResult: ConversionResult = {
			success: true,
			confidence: 'medium',
			originalCard: mockParsedCard,
			identificationMethod: 'name_only',
			moxfieldRow: {}
		};

		const csvLine = getOriginalCsvLine(mockResult);

		// Should maintain the original field order
		expect(csvLine).toBe('1,Test Card,Test Set,Common');
	});
});
