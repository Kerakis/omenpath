import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatAutoDetector } from '../lib/core/detection/index.js';
import { createConverterEngine } from '../lib/core/converter/converter-engine.js';
import type { ConversionResult } from '../lib/types.js';

// Mock Scryfall API to avoid hitting real endpoints during tests
vi.mock('../lib/scryfall-utils.js', () => ({
	checkScryfallApiHealth: vi.fn().mockResolvedValue({ healthy: true }),
	validateSetCode: vi.fn().mockResolvedValue({ valid: true }),
	findSetCodeByName: vi.fn().mockResolvedValue('M21')
}));

describe('CSV Converter Engine', () => {
	let engine: ReturnType<typeof createConverterEngine>;

	beforeEach(() => {
		engine = createConverterEngine();
		vi.clearAllMocks();
	});

	describe('Format Detection', () => {
		it('should detect Moxfield format correctly', () => {
			const csvContent =
				'Count,Name,Edition,Collector Number,Condition,Language,Foil,Tags,Last Modified,Tradelist Count';
			const result = formatAutoDetector.detectFormat(csvContent);

			expect(result.format).toBe('moxfield');
			expect(result.confidence).toBeGreaterThan(0.8);
			expect(result.missingColumns).toHaveLength(0);
		});

		it('should detect Archidekt format with high confidence', () => {
			const csvContent =
				'Count,Name,Edition,Card Number,Condition,Language,Foil,Tags,Last Modified,Collector Number,Alter,Proxy,Purchase Price';
			const result = formatAutoDetector.detectFormat(csvContent);

			expect(result.format).toBe('archidekt');
			expect(result.confidence).toBeGreaterThan(0.9);
		});

		it('should handle unknown format gracefully', () => {
			const csvContent = 'Unknown,Headers,That,Dont,Match,Anything';
			const result = formatAutoDetector.detectFormat(csvContent);

			expect(result.format).toBe('unknown');
			expect(result.confidence).toBeLessThan(0.3);
		});
	});

	describe('CSV Processing', () => {
		it('should process valid Moxfield CSV', async () => {
			const csvContent = `Count,Name,Edition,Collector Number,Condition,Language,Foil,Tags,Last Modified,Tradelist Count
1,Lightning Bolt,LEA,161,Near Mint,English,,,2023-01-01,0
2,Black Lotus,LEA,232,Near Mint,English,,,2023-01-01,0`;

			const results = await engine.processFiles(
				[{ name: 'test.csv', content: csvContent }],
				'moxfield'
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(true);
			expect(results[0].data).toBeDefined();
			expect(results[0].data!.length).toBe(2);
		});

		it('should handle malformed CSV gracefully', async () => {
			const csvContent = `Count,Name,Edition
1,Lightning Bolt
2,Black Lotus,LEA,Too,Many,Columns`;

			const results = await engine.processFiles(
				[{ name: 'malformed.csv', content: csvContent }],
				'moxfield'
			);

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(false);
			expect(results[0].error).toContain('CSV parsing error');
		});
	});

	describe('Export Functionality', () => {
		it('should export results as Moxfield CSV format', async () => {
			const mockResults: ConversionResult[] = [
				{
					success: true,
					confidence: 'high',
					identificationMethod: 'exact_match',
					originalCard: {
						name: 'Lightning Bolt',
						count: 1,
						edition: 'LEA',
						condition: 'Near Mint',
						language: 'English',
						originalData: {},
						needsLookup: false
					},
					scryfallCard: {
						id: '12345',
						name: 'Lightning Bolt',
						set: 'lea',
						collector_number: '161'
						// ... other Scryfall fields
					} as any
				}
			];

			const csvOutput = engine.exportAsMoxfieldCSV(mockResults);

			expect(csvOutput).toContain('Count,Name,Edition,Collector Number');
			expect(csvOutput).toContain('1,Lightning Bolt,LEA,161');
		});
	});

	describe('Error Handling', () => {
		it('should handle network errors gracefully', async () => {
			// Mock API failure
			vi.mocked(
				vi.importActual('../../../lib/utils/scryfall-utils.js')
			).checkScryfallApiHealth.mockRejectedValueOnce(new Error('Network error'));

			const results = await engine.processFiles(
				[{ name: 'test.csv', content: 'Count,Name\n1,Lightning Bolt' }],
				'auto'
			);

			expect(results[0].success).toBe(false);
			expect(results[0].error).toContain('Network error');
		});

		it('should provide helpful error messages for invalid formats', async () => {
			const csvContent = 'InvalidHeader1,InvalidHeader2\ndata1,data2';

			const results = await engine.processFiles(
				[{ name: 'invalid.csv', content: csvContent }],
				'auto'
			);

			expect(results[0].success).toBe(false);
			expect(results[0].error).toContain('format could not be detected');
		});
	});

	describe('Statistics Calculation', () => {
		it('should calculate conversion statistics correctly', () => {
			const mockFile = {
				filename: 'test.csv',
				success: true,
				data: [
					{ success: true, confidence: 'high' },
					{ success: true, confidence: 'medium' },
					{ success: false, error: 'Card not found' },
					{ success: true, confidence: 'low', warnings: ['Low confidence match'] }
				] as ConversionResult[]
			};

			const stats = engine.getStats(mockFile);

			expect(stats.totalEntries).toBe(4);
			expect(stats.successful).toBe(3);
			expect(stats.failed).toBe(1);
			expect(stats.warnings).toBe(1);
		});
	});
});
