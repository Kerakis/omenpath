import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import FailedCardsDisplay from '../../lib/components/conversion/ConversionResults/FailedCardsDisplay.svelte';
import type { ConversionResult, ParsedCard, ScryfallCard } from '../../lib/types.js';

describe('FailedCardsDisplay', () => {
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

	const createMockResult = (
		name: string,
		success: boolean,
		error?: string,
		warnings?: string[],
		rowNumber?: number
	): ConversionResult => ({
		success,
		error,
		warnings,
		confidence: success ? 'high' : 'low',
		originalCard: {
			originalData: { Count: '1', Name: name, Set: 'LEA' },
			count: 1,
			name,
			edition: 'lea',
			needsLookup: true,
			sourceRowNumber: rowNumber
		} as ParsedCard,
		identificationMethod: success ? 'name_set' : 'failed',
		moxfieldRow: {},
		...(success && { scryfallCard: mockScryfallCard })
	});

	it('should not render when there are no issues', () => {
		const successfulResults = [createMockResult('Lightning Bolt', true)];

		render(FailedCardsDisplay, {
			props: {
				results: successfulResults,
				showAdditionalColumns: false
			}
		});

		// Should not show the "Conversion Issues" heading when there are no failed cards or warnings
		expect(screen.queryByText('Conversion Issues')).toBeNull();
	});

	it('should display error cards', () => {
		const results = [createMockResult('Unknown Card', false, 'Card not found', undefined, 2)];

		render(FailedCardsDisplay, {
			props: {
				results,
				showAdditionalColumns: false
			}
		});

		expect(screen.getByText('Conversion Issues')).toBeDefined();
		expect(screen.getByText('Unknown Card')).toBeDefined();
		expect(screen.getByText('Error')).toBeDefined();
		expect(screen.getByText('Card not found')).toBeDefined();
		expect(screen.getByText('Row 2')).toBeDefined();
	});

	it('should display warning cards', () => {
		const results = [
			createMockResult('Lightning Bolt', true, undefined, ['Set code corrected'], 3)
		];

		render(FailedCardsDisplay, {
			props: {
				results,
				showAdditionalColumns: false
			}
		});

		expect(screen.getByText('Conversion Issues')).toBeDefined();
		expect(screen.getByText('Lightning Bolt')).toBeDefined();
		expect(screen.getByText('Warning')).toBeDefined();
		expect(screen.getByText('Set code corrected')).toBeDefined();
		expect(screen.getByText('Row 3')).toBeDefined();
	});

	it('should sort errors before warnings', () => {
		const results = [
			createMockResult('Warning Card', true, undefined, ['Some warning'], 1),
			createMockResult('Error Card', false, 'Some error', undefined, 2),
			createMockResult('Another Warning', true, undefined, ['Another warning'], 3)
		];

		const { container } = render(FailedCardsDisplay, {
			props: {
				results,
				showAdditionalColumns: false
			}
		});

		const rows = container.querySelectorAll('tbody tr');
		expect(rows).toHaveLength(3);

		// First row should be the error card
		expect(rows[0].textContent).toContain('Error Card');
		expect(rows[0].textContent).toContain('Error');

		// Subsequent rows should be warning cards
		expect(rows[1].textContent).toContain('Warning Card');
		expect(rows[1].textContent).toContain('Warning');
		expect(rows[2].textContent).toContain('Another Warning');
		expect(rows[2].textContent).toContain('Warning');
	});

	it('should show additional columns when requested', () => {
		const results = [createMockResult('Test Card', false, 'Test error', undefined, 1)];

		// Update the mock to include collector number and language
		results[0].originalCard.collectorNumber = '42';
		results[0].originalCard.language = 'English';

		render(FailedCardsDisplay, {
			props: {
				results,
				showAdditionalColumns: true
			}
		});

		expect(screen.getByText('Collector Number')).toBeDefined();
		expect(screen.getByText('Language')).toBeDefined();
		expect(screen.getByText('42')).toBeDefined();
		expect(screen.getByText('English')).toBeDefined();
	});

	it('should not show additional columns when not requested', () => {
		const results = [createMockResult('Test Card', false, 'Test error', undefined, 1)];

		render(FailedCardsDisplay, {
			props: {
				results,
				showAdditionalColumns: false
			}
		});

		expect(screen.queryByText('Collector Number')).toBeNull();
		expect(screen.queryByText('Language')).toBeNull();
	});

	it('should handle multiple warnings in one card', () => {
		const results = [
			createMockResult(
				'Multi Warning Card',
				true,
				undefined,
				['First warning', 'Second warning', 'Third warning'],
				5
			)
		];

		render(FailedCardsDisplay, {
			props: {
				results,
				showAdditionalColumns: false
			}
		});

		expect(screen.getByText('Multi Warning Card')).toBeDefined();
		expect(screen.getByText('Warning')).toBeDefined();
		expect(screen.getByText('First warning, Second warning, Third warning')).toBeDefined();
	});

	it('should display helpful footer message', () => {
		const results = [
			createMockResult('Error Card', false, 'Some error', undefined, 1),
			createMockResult('Warning Card', true, undefined, ['Some warning'], 2)
		];

		render(FailedCardsDisplay, {
			props: {
				results,
				showAdditionalColumns: false
			}
		});

		expect(screen.getByText(/Use the row numbers to locate these entries/)).toBeDefined();
		expect(screen.getByText(/Cards with warnings were still processed/)).toBeDefined();
	});
});
