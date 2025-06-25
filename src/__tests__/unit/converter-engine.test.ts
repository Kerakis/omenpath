import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createConverterEngine } from '../../lib/core/converter/converter-engine.js';

// Mock the dependencies
vi.mock('../../lib/core/detection/index.js', () => ({
	formatAutoDetector: {
		getAllFormats: () => [
			{ id: 'archidekt', name: 'Archidekt' },
			{ id: 'moxfield', name: 'Moxfield' }
		],
		detectFormat: (headers: string[]) => {
			if (headers.includes('Count') && headers.includes('Name')) {
				return { format: { id: 'archidekt', name: 'Archidekt' } };
			}
			return null;
		}
	}
}));

vi.mock('../../lib/core/converter/parsing/csv-parser.js', () => ({
	parseCSVContent: vi.fn().mockImplementation(async (content, format, progressCallback) => {
		// Simulate progress callback
		if (progressCallback) {
			progressCallback(50);
			progressCallback(100);
		}
		return [
			{
				originalData: { Count: '1', Name: 'Lightning Bolt' },
				count: 1,
				name: 'Lightning Bolt',
				needsLookup: true
			}
		];
	}),
	detectFormatFromContent: vi.fn().mockReturnValue({
		format: { id: 'archidekt', name: 'Archidekt' }
	})
}));

vi.mock('../../lib/utils/scryfall-utils.js', () => ({
	checkScryfallApiHealth: vi.fn().mockResolvedValue({
		available: true
	})
}));

vi.mock('../../lib/core/converter/validation/set-validator.js', () => ({
	validateSetCodes: vi.fn().mockResolvedValue({
		hasInvalidSetCodes: false,
		invalidSetCodes: []
	})
}));

describe('converter-engine', () => {
	let engine: ReturnType<typeof createConverterEngine>;

	beforeEach(() => {
		engine = createConverterEngine();
	});

	describe('getSupportedFormats', () => {
		it('should return available formats', () => {
			const formats = engine.getSupportedFormats();

			expect(formats).toHaveLength(2);
			expect(formats[0]).toEqual({ id: 'archidekt', name: 'Archidekt' });
			expect(formats[1]).toEqual({ id: 'moxfield', name: 'Moxfield' });
		});
	});

	describe('detectFormat', () => {
		it('should detect format from headers', () => {
			const format = engine.detectFormat(['Count', 'Name', 'Set']);

			expect(format).toBe('archidekt');
		});

		it('should return null for unknown headers', () => {
			const format = engine.detectFormat(['Unknown', 'Headers']);

			expect(format).toBeNull();
		});
	});

	describe('detectFormatFromContent', () => {
		it('should detect format from CSV content', async () => {
			const csvContent = 'Count,Name,Set\\n1,Lightning Bolt,LEA';
			const result = await engine.detectFormatFromContent(csvContent);

			expect(result).toEqual({
				format: { id: 'archidekt', name: 'Archidekt' }
			});
		});
	});

	describe('parseFile', () => {
		it('should parse CSV file', async () => {
			const mockFile = new File(['Count,Name\\n1,Lightning Bolt'], 'test.csv', {
				type: 'text/csv'
			});

			const result = await engine.parseFile(mockFile, 'archidekt');

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('Lightning Bolt');
			expect(result[0].count).toBe(1);
		});

		it('should call progress callback during parsing', async () => {
			const mockFile = new File(['Count,Name\\n1,Lightning Bolt'], 'test.csv', {
				type: 'text/csv'
			});
			const progressCallback = vi.fn();

			await engine.parseFile(mockFile, 'archidekt', progressCallback);

			// Progress callback should have been called
			expect(progressCallback).toHaveBeenCalled();
		});
	});

	describe('validateSetCodes', () => {
		it('should validate set codes', async () => {
			const mockCards = [
				{
					originalData: { Count: '1', Name: 'Lightning Bolt', Set: 'LEA' },
					count: 1,
					name: 'Lightning Bolt',
					edition: 'lea',
					needsLookup: true
				}
			];

			const result = await engine.validateSetCodes(mockCards);

			expect(result.hasInvalidSetCodes).toBe(false);
			expect(result.invalidSetCodes).toEqual([]);
		});
	});

	describe('checkApiHealth', () => {
		it('should check API health', async () => {
			const result = await engine.checkApiHealth();

			expect(result.available).toBe(true);
		});
	});
});
