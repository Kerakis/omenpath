import type {
	ParsedCard,
	ConversionResult,
	ProgressCallback,
	ExportOptions
} from '../../../types.js';
import { performNameAndCollectorNumberLookups } from '../strategies/name-collector-lookup.js';
import { performPrimaryLookups } from '../strategies/primary-lookup.js';
import { performLanguageValidationAndSecondaryLookups } from '../strategies/secondary-lookup.js';
import { createSuccessfulResult } from '../result-formatter.js';
import { assignInitialConfidence } from '../validation/set-validator.js';

/**
 * Orchestrates the conversion of parsed cards through the 3-step lookup process.
 * This is the main conversion pipeline used by both convertFile and convertPrevalidatedCards.
 */
export async function convertParsedCards(
	parsedCards: ParsedCard[],
	progressCallback?: ProgressCallback,
	defaultCondition?: string,
	exportOptions?: ExportOptions
): Promise<ConversionResult[]> {
	// Ensure all cards have confidence levels (fallback if missing)
	for (const card of parsedCards) {
		if (!card.initialConfidence) {
			assignInitialConfidence(card);
		}
	}

	if (progressCallback) progressCallback(20);

	// Step 1: Handle special case of name + collector number (no set)
	const { processedCards, nameOnlyCards } = await performNameAndCollectorNumberLookups(parsedCards);

	// Create results for cards that were successfully found via search
	const searchResults: ConversionResult[] = [];
	for (const card of processedCards) {
		if (card.foundViaNameCollectorSearch && card.scryfallCardData) {
			// Use the stored Scryfall card data directly - no need for additional API calls
			searchResults.push(
				createSuccessfulResult(card, card.scryfallCardData, defaultCondition, exportOptions)
			);
		} else {
			// Card without stored data should go to primary lookup
			nameOnlyCards.push(card);
		}
	}

	// Only send nameOnlyCards (fallback cases) to the collection endpoint
	const allCardsForPrimaryLookup = nameOnlyCards;

	if (progressCallback) progressCallback(30);

	// Step 2: Perform primary lookups (set validation should have happened before conversion)
	const primaryResults = await performPrimaryLookups(
		allCardsForPrimaryLookup,
		progressCallback,
		defaultCondition,
		exportOptions
	);

	if (progressCallback) progressCallback(80);

	// Step 3: Language validation and secondary lookups
	const finalResults = await performLanguageValidationAndSecondaryLookups(
		primaryResults,
		defaultCondition,
		progressCallback,
		exportOptions
	);

	// Combine search results with final results
	const allResults = [...searchResults, ...finalResults];

	// Sort results and assign output row numbers for preview display
	const sortedResults = sortConversionResults(allResults);

	// Assign output row numbers (1-based, accounting for header)
	sortedResults.forEach((result, index) => {
		result.outputRowNumber = index + 2;
	});

	if (progressCallback) progressCallback(100);
	return sortedResults;
}

/**
 * Sorts conversion results by priority: errors first, then warnings, then successful entries.
 * Within each priority group, sorts alphabetically by card name.
 */
function sortConversionResults(results: ConversionResult[]): ConversionResult[] {
	return [...results].sort((a, b) => {
		// Priority: errors (0), warnings (1), success (2)
		const aPriority = !a.success || a.error ? 0 : a.warnings && a.warnings.length > 0 ? 1 : 2;
		const bPriority = !b.success || b.error ? 0 : b.warnings && b.warnings.length > 0 ? 1 : 2;

		if (aPriority !== bPriority) {
			return aPriority - bPriority;
		}

		// Within same priority, sort alphabetically by name
		const aName = a.moxfieldRow.Name || '';
		const bName = b.moxfieldRow.Name || '';
		return aName.localeCompare(bName);
	});
}
