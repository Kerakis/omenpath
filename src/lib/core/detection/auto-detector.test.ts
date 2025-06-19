import { describe, it, expect } from 'vitest';
import { formatAutoDetector } from './auto-detector.js';
import type { CsvFormat } from '../../types.js';

describe('Format Auto-Detection', () => {
	describe('Moxfield Format Detection', () => {
		it('should detect Moxfield format with high confidence', () => {
			const headers = [
				'Quantity',
				'Name',
				'Edition',
				'Collector Number',
				'Condition',
				'Foil',
				'Scryfall ID'
			];
			const result = formatAutoDetector.detectFormat(headers);

			expect(result).not.toBeNull();
			expect(result!.format.id).toBe('moxfield');
			expect(result!.confidence).toBeGreaterThan(0.8);
			expect(result!.matchingHeaders).toContain('Scryfall ID');
			expect(result!.matchingHeaders).toContain('Edition');
		});

		it('should detect Moxfield with partial headers', () => {
			const headers = ['Quantity', 'Name', 'Scryfall ID'];
			const result = formatAutoDetector.detectFormat(headers);

			expect(result).not.toBeNull();
			expect(result!.format.id).toBe('moxfield');
			expect(result!.confidence).toBeGreaterThan(0.5);
		});

		it('should detect case-insensitive Moxfield headers', () => {
			const headers = ['quantity', 'name', 'edition', 'scryfall id'];
			const result = formatAutoDetector.detectFormat(headers);

			expect(result).not.toBeNull();
			expect(result!.format.id).toBe('moxfield');
		});
	});

	describe('Archidekt Format Detection', () => {
		it('should detect Archidekt format with distinctive headers', () => {
			const headers = [
				'Count',
				'Name',
				'Edition',
				'Card Number',
				'Condition',
				'Language',
				'Foil',
				'Tags',
				'Last Modified',
				'Collector Number',
				'Alter',
				'Proxy',
				'Purchase Price'
			];
			const result = formatAutoDetector.detectFormat(headers);

			expect(result).not.toBeNull();
			expect(result!.format.id).toBe('archidekt');
			expect(result!.confidence).toBeGreaterThan(0.8);
			expect(result!.matchingHeaders).toContain('Purchase Price');
			expect(result!.matchingHeaders).toContain('Last Modified');
		});

		it('should distinguish Archidekt from similar formats', () => {
			// Archidekt has unique "Purchase Price" and "Last Modified" columns
			const archidektHeaders = ['Count', 'Name', 'Edition', 'Purchase Price', 'Last Modified'];
			const result = formatAutoDetector.detectFormat(archidektHeaders);

			expect(result).not.toBeNull();
			expect(result!.format.id).toBe('archidekt');
			expect(result!.confidence).toBeGreaterThan(0.6);
		});
	});

	describe('DeckBox Format Detection', () => {
		it('should detect DeckBox format', () => {
			const headers = [
				'Count',
				'Tradelist Count',
				'Name',
				'Edition',
				'Card Number',
				'Condition',
				'Language',
				'Foil',
				'Signed',
				'Artist Proof',
				'Altered Art',
				'Misprint',
				'Promo',
				'Textless',
				'My Price'
			];
			const result = formatAutoDetector.detectFormat(headers);

			expect(result).not.toBeNull();
			expect(result!.format.id).toBe('deckbox');
			expect(result!.confidence).toBeGreaterThan(0.7);
			expect(result!.matchingHeaders).toContain('Tradelist Count');
			expect(result!.matchingHeaders).toContain('My Price');
		});
	});

	describe('ManaBox Format Detection', () => {
		it('should detect ManaBox format', () => {
			const headers = [
				'Quantity',
				'Name',
				'Simple Name',
				'Set',
				'Mana Cost',
				'Type',
				'Rarity',
				'Language',
				'Condition',
				'Foil',
				'Quantity Foil',
				'Card Number',
				'Price From',
				'Total Price'
			];
			const result = formatAutoDetector.detectFormat(headers);

			expect(result).not.toBeNull();
			expect(result!.format.id).toBe('manabox');
			expect(result!.confidence).toBeGreaterThan(0.8);
			expect(result!.matchingHeaders).toContain('Simple Name');
			expect(result!.matchingHeaders).toContain('Quantity Foil');
		});
	});

	describe('Edge Cases and Error Handling', () => {
		it('should return null for empty headers', () => {
			const result = formatAutoDetector.detectFormat([]);
			expect(result).toBeNull();
		});
		it('should return null for undefined headers', () => {
			// @ts-expect-error Testing invalid input
			const result = formatAutoDetector.detectFormat(undefined);
			expect(result).toBeNull();
		});

		it('should return null for low confidence matches', () => {
			const headers = ['UnknownColumn1', 'UnknownColumn2', 'UnknownColumn3'];
			const result = formatAutoDetector.detectFormat(headers);
			expect(result).toBeNull();
		});

		it('should handle headers with extra whitespace', () => {
			const headers = ['  Quantity  ', ' Name ', ' Edition ', ' Scryfall ID '];
			const result = formatAutoDetector.detectFormat(headers);

			expect(result).not.toBeNull();
			expect(result!.format.id).toBe('moxfield');
		});

		it('should handle duplicate headers gracefully', () => {
			const headers = ['Quantity', 'Name', 'Name', 'Edition', 'Scryfall ID'];
			const result = formatAutoDetector.detectFormat(headers);

			expect(result).not.toBeNull();
			expect(result!.format.id).toBe('moxfield');
		});
	});

	describe('Format Prioritization', () => {
		it('should prefer more specific formats over generic ones', () => {
			// Test case where multiple formats might match but one is more specific
			const headers = ['Count', 'Name', 'Edition', 'Purchase Price', 'Last Modified'];
			const result = formatAutoDetector.detectFormat(headers);

			expect(result).not.toBeNull();
			// Should detect Archidekt (more specific) rather than generic format
			expect(result!.format.id).toBe('archidekt');
		});

		it('should return highest confidence match when multiple formats match', () => {
			// Headers that could match multiple formats
			const headers = ['Count', 'Name', 'Edition', 'Condition'];
			const result = formatAutoDetector.detectFormat(headers);

			expect(result).not.toBeNull();
			expect(result!.confidence).toBeGreaterThan(0);
			// Should return the format with highest confidence
		});
	});

	describe('Real CSV Header Examples', () => {
		it('should detect Cardsphere format', () => {
			const headers = ['Have Qty', 'Card', 'Set', 'Condition', 'Language', 'Foil'];
			const result = formatAutoDetector.detectFormat(headers);

			expect(result).not.toBeNull();
			expect(result!.format.id).toBe('cardsphere');
			expect(result!.matchingHeaders).toContain('Have Qty');
		});

		it('should detect MTGO format', () => {
			const headers = ['Card Name', 'Quantity', 'Premium', 'Set Name'];
			const result = formatAutoDetector.detectFormat(headers);

			expect(result).not.toBeNull();
			expect(result!.format.id).toBe('mtgo');
			expect(result!.matchingHeaders).toContain('Premium');
		});

		it('should detect TCGPlayer format', () => {
			const headers = [
				'TCGPlayer Id',
				'Product Line',
				'Set Name',
				'Product Name',
				'Title',
				'Number',
				'Rarity',
				'Condition',
				'TCG Market Price',
				'TCG Direct Low',
				'TCG Low Price With Shipping',
				'TCG Low Price',
				'Total Quantity',
				'Add to Quantity',
				'TCG Marketplace Price',
				'Photo URL'
			];
			const result = formatAutoDetector.detectFormat(headers);

			expect(result).not.toBeNull();
			expect(result!.format.id).toBe('tcgplayer');
			expect(result!.matchingHeaders).toContain('TCGPlayer Id');
		});

		it('should detect DragonShield format', () => {
			const headers = [
				'Folder Name',
				'Quantity',
				'Card Name',
				'Set Code',
				'Set Name',
				'Card Number',
				'Condition',
				'Printing',
				'Language',
				'Price Bought',
				'Date Bought',
				'Low Price',
				'Mid Price',
				'High Price'
			];
			const result = formatAutoDetector.detectFormat(headers);

			expect(result).not.toBeNull();
			expect(result!.format.id).toBe('dragonshield');
			expect(result!.matchingHeaders).toContain('Folder Name');
		});
	});

	describe('Confidence Scoring', () => {
		it('should give higher confidence for formats with unique identifying headers', () => {
			// Moxfield with unique Scryfall ID
			const moxfieldHeaders = ['Quantity', 'Name', 'Scryfall ID'];
			const moxfieldResult = formatAutoDetector.detectFormat(moxfieldHeaders);

			// Generic headers that could match multiple formats
			const genericHeaders = ['Count', 'Name', 'Edition'];
			const genericResult = formatAutoDetector.detectFormat(genericHeaders);

			expect(moxfieldResult).not.toBeNull();
			expect(genericResult).not.toBeNull();
			expect(moxfieldResult!.confidence).toBeGreaterThan(genericResult!.confidence);
		});

		it('should scale confidence based on number of matching headers', () => {
			// More matching headers should yield higher confidence
			const manyHeaders = [
				'Quantity',
				'Name',
				'Edition',
				'Collector Number',
				'Condition',
				'Foil',
				'Scryfall ID'
			];
			const fewHeaders = ['Quantity', 'Name'];

			const manyResult = formatAutoDetector.detectFormat(manyHeaders);
			const fewResult = formatAutoDetector.detectFormat(fewHeaders);

			expect(manyResult).not.toBeNull();
			expect(fewResult).not.toBeNull();
			expect(manyResult!.confidence).toBeGreaterThan(fewResult!.confidence);
		});
	});

	describe('getAllFormats', () => {
		it('should return all supported formats', () => {
			const formats = formatAutoDetector.getAllFormats();

			expect(formats).toBeInstanceOf(Array);
			expect(formats.length).toBeGreaterThan(10); // We have many formats
			// Check that common formats are included
			const formatIds = formats.map((f: CsvFormat) => f.id);
			expect(formatIds).toContain('moxfield');
			expect(formatIds).toContain('archidekt');
			expect(formatIds).toContain('deckbox');
			expect(formatIds).toContain('manabox');
		});

		it('should return formats with required properties', () => {
			const formats = formatAutoDetector.getAllFormats();

			formats.forEach((format: CsvFormat) => {
				expect(format).toHaveProperty('id');
				expect(format).toHaveProperty('name');
				expect(format).toHaveProperty('columnMappings');
				expect(typeof format.id).toBe('string');
				expect(typeof format.name).toBe('string');
				expect(typeof format.columnMappings).toBe('object');
			});
		});
	});
});
