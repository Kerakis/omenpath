import { describe, it, expect } from 'vitest';
import { parseDekContent, isDekFormat } from '../../lib/core/converter/parsing/dek-parser.js';

describe('DEK Parser', () => {
	const sampleDekContent = `<?xml version="1.0" encoding="utf-8"?>
<Deck xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NetDeckID>0</NetDeckID>
  <PreconstructedDeckID>0</PreconstructedDeckID>
  <Cards CatID="79038" Quantity="1" Sideboard="false" Name="Reaper King" Annotation="0" />
  <Cards CatID="79040" Quantity="2" Sideboard="false" Name="Sliver Overlord" Annotation="0" />
  <Cards CatID="79042" Quantity="1" Sideboard="true" Name="Sideboard Card" Annotation="0" />
</Deck>`;

	describe('isDekFormat', () => {
		it('should detect valid DEK format', () => {
			expect(isDekFormat(sampleDekContent)).toBe(true);
		});

		it('should reject CSV content', () => {
			const csvContent = 'Quantity,Name,Set\n1,Lightning Bolt,LEA';
			expect(isDekFormat(csvContent)).toBe(false);
		});

		it('should reject non-XML content', () => {
			const plainText = 'This is just plain text';
			expect(isDekFormat(plainText)).toBe(false);
		});

		it('should reject XML without Deck element', () => {
			const xmlWithoutDeck = `<?xml version="1.0" encoding="utf-8"?>
<SomeOtherElement>Content</SomeOtherElement>`;
			expect(isDekFormat(xmlWithoutDeck)).toBe(false);
		});
	});

	describe('parseDekContent', () => {
		it('should parse valid DEK content', async () => {
			const cards = await parseDekContent(sampleDekContent);

			expect(cards).toHaveLength(2); // Should skip sideboard cards
			expect(cards[0]).toMatchObject({
				name: 'Reaper King',
				count: 1,
				mtgoId: 79038,
				needsLookup: true
			});
			expect(cards[1]).toMatchObject({
				name: 'Sliver Overlord',
				count: 2,
				mtgoId: 79040
			});
		});

		it('should skip sideboard cards', async () => {
			const cards = await parseDekContent(sampleDekContent);

			const hasSideboard = cards.some((card) => card.name === 'Sideboard Card');
			expect(hasSideboard).toBe(false);
		});

		it('should handle cards with different quantities', async () => {
			const cards = await parseDekContent(sampleDekContent);

			expect(cards.find((c) => c.name === 'Reaper King')?.count).toBe(1);
			expect(cards.find((c) => c.name === 'Sliver Overlord')?.count).toBe(2);
		});

		it('should preserve original data', async () => {
			const cards = await parseDekContent(sampleDekContent);

			expect(cards[0].originalData).toMatchObject({
				name: 'Reaper King',
				catID: '79038',
				quantity: '1',
				sideboard: 'false'
			});
		});

		it('should throw on invalid XML', async () => {
			const invalidXml = '<?xml version="1.0"?><InvalidXml>';

			await expect(parseDekContent(invalidXml)).rejects.toThrow();
		});

		it('should throw on empty DEK file', async () => {
			const emptyDek = `<?xml version="1.0" encoding="utf-8"?>
<Deck xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <NetDeckID>0</NetDeckID>
</Deck>`;

			await expect(parseDekContent(emptyDek)).rejects.toThrow(/no card entries/i);
		});

		it('should throw when all cards are sideboards', async () => {
			const onlySideboard = `<?xml version="1.0" encoding="utf-8"?>
<Deck xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Cards CatID="79038" Quantity="1" Sideboard="true" Name="Sideboard Only" Annotation="0" />
</Deck>`;

			await expect(parseDekContent(onlySideboard)).rejects.toThrow(/no valid cards found/i);
		});

		it('should handle progress callback', async () => {
			const progressUpdates: number[] = [];
			const callback = (progress: number) => progressUpdates.push(progress);

			await parseDekContent(sampleDekContent, callback);

			expect(progressUpdates.length).toBeGreaterThan(0);
			expect(progressUpdates[0]).toBe(10);
			expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
		});

		it('should set mtgoId from CatID', async () => {
			const cards = await parseDekContent(sampleDekContent);

			expect(cards.every((card) => typeof card.mtgoId === 'number')).toBe(true);
			expect(cards[0].mtgoId).toBe(79038);
		});

		it('should set initialConfidence to high', async () => {
			const cards = await parseDekContent(sampleDekContent);

			expect(cards.every((card) => card.initialConfidence === 'high')).toBe(true);
		});
	});
});
