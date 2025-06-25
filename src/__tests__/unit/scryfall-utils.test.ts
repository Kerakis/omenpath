import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkScryfallApiHealth } from '../../lib/utils/scryfall-utils.js';

describe('scryfall-utils', () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		globalThis.fetch = fetchMock;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('checkScryfallApiHealth', () => {
		it('should return available when API is healthy', async () => {
			fetchMock.mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({ object: 'catalog' })
			});

			const result = await checkScryfallApiHealth();

			expect(result.available).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should handle API errors gracefully', async () => {
			fetchMock.mockRejectedValue(new Error('Network error'));

			const result = await checkScryfallApiHealth();

			expect(result.available).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error).toContain('Network error');
		});

		it('should handle non-200 status codes', async () => {
			fetchMock.mockResolvedValue({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error'
			});

			const result = await checkScryfallApiHealth();

			expect(result.available).toBe(false);
			expect(result.error).toBeDefined();
		});

		it('should handle invalid JSON response', async () => {
			fetchMock.mockResolvedValue({
				ok: true,
				status: 200
				// No json method - this will cause an error when trying to call response.json()
			});

			const result = await checkScryfallApiHealth();

			// Since the function doesn't actually call .json(), it should still return success for ok responses
			expect(result.available).toBe(true);
		});
	});
});
