import { describe, it, expect } from 'vitest';
import {
	getStats,
	getConfidenceStats,
	getIdentificationMethods
} from '../../lib/utils/conversion/stats-calculator.js';
import type { ConversionResult, ParsedCard, ScryfallCard } from '../../lib/types.js';

describe('stats-calculator', () => {
	// Mock parsed card data
	const mockParsedCard: ParsedCard = {
		originalData: { Count: '2', Name: 'Lightning Bolt', Set: 'LEA' },
		count: 2,
		name: 'Lightning Bolt',
		edition: 'lea',
		needsLookup: true
	};

	const mockFailedParsedCard: ParsedCard = {
		originalData: { Count: '1', Name: 'Unknown Card' },
		count: 1,
		name: 'Unknown Card',
		needsLookup: true
	};

	const mockLowConfidenceParsedCard: ParsedCard = {
		originalData: { Count: '1', Name: 'Fuzy Match', Set: 'LEA' },
		count: 1,
		name: 'Fuzy Match',
		edition: 'lea',
		needsLookup: true
	};

	// Mock Scryfall card data
	const mockScryfallCard: ScryfallCard = {
		id: 'test-id',
		name: 'Lightning Bolt',
		set: 'lea',
		set_name: 'Limited Edition Alpha',
		collector_number: '1',
		rarity: 'common',
		type_line: 'Instant',
		color_identity: ['R'],
		legalities: { standard: 'not_legal' },
		reserved: false,
		foil: false,
		nonfoil: true,
		finishes: ['nonfoil'],
		prices: { usd: '10.00' },
		lang: 'en',
		released_at: '1993-08-05',
		uri: 'https://api.scryfall.com/cards/test',
		scryfall_uri: 'https://scryfall.com/card/test',
		layout: 'normal'
	};

	// Mock conversion results
	const mockSuccessfulResult: ConversionResult = {
		success: true,
		scryfallCard: mockScryfallCard,
		confidence: 'high',
		originalCard: mockParsedCard,
		identificationMethod: 'name_set',
		moxfieldRow: {}
	};

	const mockFailedResult: ConversionResult = {
		success: false,
		error: 'Card not found',
		originalCard: mockFailedParsedCard,
		confidence: 'low',
		identificationMethod: 'failed',
		moxfieldRow: {}
	};

	const mockLowConfidenceResult: ConversionResult = {
		success: true,
		scryfallCard: { ...mockScryfallCard, id: 'test-id-2', name: 'Fuzzy Match' },
		confidence: 'low',
		originalCard: mockLowConfidenceParsedCard,
		identificationMethod: 'name_only',
		moxfieldRow: {}
	};

	const mockResultFile = {
		filename: 'test.csv',
		success: true,
		data: [mockSuccessfulResult, mockFailedResult, mockLowConfidenceResult]
	};

	describe('getStats', () => {
		it('should calculate basic statistics correctly', () => {
			const stats = getStats(mockResultFile);

			expect(stats.totalEntries).toBe(3);
			expect(stats.totalCards).toBe(4); // 2 + 1 + 1
			expect(stats.successful).toBe(2);
			expect(stats.failed).toBe(1);
		});

		it('should handle empty data', () => {
			const emptyFile = { filename: 'empty.csv', success: true, data: [] };
			const stats = getStats(emptyFile);

			expect(stats.totalEntries).toBe(0);
			expect(stats.totalCards).toBe(0);
			expect(stats.successful).toBe(0);
			expect(stats.failed).toBe(0);
		});

		it('should handle file without data', () => {
			const fileWithoutData = { filename: 'error.csv', success: false, error: 'Parse error' };
			const stats = getStats(fileWithoutData);

			expect(stats.totalEntries).toBe(0);
			expect(stats.totalCards).toBe(0);
			expect(stats.successful).toBe(0);
			expect(stats.failed).toBe(0);
		});
	});

	describe('getConfidenceStats', () => {
		it('should calculate confidence statistics correctly', () => {
			const confidenceStats = getConfidenceStats(mockResultFile);

			expect(confidenceStats.veryHigh).toBe(0);
			expect(confidenceStats.high).toBe(1);
			expect(confidenceStats.medium).toBe(0);
			expect(confidenceStats.low).toBe(1);
			expect(confidenceStats.error).toBe(1);
			expect(confidenceStats.uncertain).toBe(2); // medium + low + error
		});

		it('should handle empty data', () => {
			const emptyFile = { filename: 'empty.csv', success: true, data: [] };
			const stats = getConfidenceStats(emptyFile);

			expect(stats.veryHigh).toBe(0);
			expect(stats.high).toBe(0);
			expect(stats.medium).toBe(0);
			expect(stats.low).toBe(0);
			expect(stats.error).toBe(0);
			expect(stats.uncertain).toBe(0);
		});
	});

	describe('getIdentificationMethods', () => {
		it('should count identification methods', () => {
			const methods = getIdentificationMethods(mockResultFile);

			expect(methods.name_set).toBe(1);
			expect(methods.name_only).toBe(1);
			expect(methods.failed).toBe(1);
			// The function returns counts by method, not a total property
		});

		it('should handle file without successful results', () => {
			const failedFile = {
				filename: 'failed.csv',
				success: true,
				data: [mockFailedResult]
			};
			const methods = getIdentificationMethods(failedFile);

			expect(methods.failed).toBe(1);
		});

		it('should handle empty data', () => {
			const emptyFile = { filename: 'empty.csv', success: true, data: [] };
			const methods = getIdentificationMethods(emptyFile);

			expect(methods).toEqual({});
		});
	});
});
