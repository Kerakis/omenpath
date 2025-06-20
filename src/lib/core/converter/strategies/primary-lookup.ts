import type {
	ParsedCard,
	ConversionResult,
	CardIdentifier,
	ProgressCallback,
	ExportOptions
} from '../../../types.js';
import {
	fetchScryfallCollection,
	applyRateLimit,
	getBatchSize,
	isIdentifierMatch
} from '../api/scryfall-api.js';
import { validateScryfallMatch } from '../validation/card-validator.js';
import { createSuccessfulResult, createFailedResult } from '../result-formatter.js';
import { searchScryfallCards } from '../../../utils/scryfall-utils.js';

/**
 * Handle special promo card search cases (Judge, Prerelease, Promo Pack)
 */
async function handleSpecialPromoSearch(
	card: ParsedCard,
	defaultCondition?: string,
	exportOptions?: ExportOptions
): Promise<ConversionResult | null> {
	const specialSearchQuery = (card as Record<string, unknown>).specialSearchQuery as
		| string
		| undefined;
	if (!specialSearchQuery) {
		return null; // Not a special promo card
	}

	try {
		const searchResult = await searchScryfallCards(card.name, specialSearchQuery);

		if (searchResult.cards.length === 0) {
			// No cards found
			return createFailedResult(card, 'No matching promo cards found via special search');
		}

		const selectedCard = searchResult.cards[0]; // Use the first result
		let confidence: 'very_high' | 'high' | 'medium' | 'low' = 'high';
		const warnings: string[] = [];

		// Add search warnings
		if (searchResult.warnings) {
			warnings.push(...searchResult.warnings);
		}

		// Adjust confidence based on number of results
		if (searchResult.cards.length > 1) {
			confidence = 'medium'; // Reduce confidence when multiple options exist
			warnings.push(
				`Multiple promo versions found (${searchResult.cards.length}), using first result - please verify`
			);
		}

		// Validate the match (if we have enough data to validate)
		const validation = validateScryfallMatch(card, selectedCard);
		if (!validation.isValid && validation.errors.length > 0) {
			// Only fail on set/collector number mismatches, not name mismatches for promos
			const criticalErrors = validation.errors.filter((error) => !error.includes('Name mismatch'));

			if (criticalErrors.length > 0) {
				warnings.push(...criticalErrors);
				confidence = 'low'; // Reduce confidence but don't fail
			}
		}

		// Create successful result with special promo handling
		const result = createSuccessfulResult(card, selectedCard, defaultCondition, exportOptions);

		// Override confidence and add warnings
		result.confidence = confidence;
		result.identificationMethod = 'special_case'; // Special promo search uses dedicated handling
		if (warnings.length > 0) {
			result.warnings = warnings;
		}

		return result;
	} catch (error) {
		console.error('Special promo search error:', error);
		return createFailedResult(
			card,
			`Special promo search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Perform primary lookups using Collection endpoint (PROPERLY MIXING IDENTIFIERS)
 */
export async function performPrimaryLookups(
	cards: ParsedCard[],
	progressCallback?: ProgressCallback,
	defaultCondition?: string,
	exportOptions?: ExportOptions
): Promise<Array<{ card: ParsedCard; result?: ConversionResult; needsRetry?: boolean }>> {
	const results: Array<{ card: ParsedCard; result?: ConversionResult; needsRetry?: boolean }> = [];

	// All cards need API lookup to get complete Scryfall data for Moxfield conversion
	const cardsNeedingLookup = cards;

	let processed = 0;
	const total = cardsNeedingLookup.length;

	console.log(
		`Total cards: ${cards.length}, Cards needing API lookup: ${cardsNeedingLookup.length}`
	);

	if (cardsNeedingLookup.length === 0) {
		if (progressCallback) progressCallback(60);
		return results;
	}

	// First, handle special promo searches individually (these need the search endpoint)
	const regularCards: ParsedCard[] = [];

	for (const card of cardsNeedingLookup) {
		const cardAsRecord = card as Record<string, unknown>;
		const specialSearchQuery = cardAsRecord.specialSearchQuery as string | undefined;

		if (specialSearchQuery) {
			// Handle special promo search
			console.log(`Handling special promo search for: ${card.name} (${specialSearchQuery})`);
			const specialResult = await handleSpecialPromoSearch(card, defaultCondition, exportOptions);

			if (specialResult) {
				results.push({ card, result: specialResult });
				processed++;
				if (progressCallback) {
					progressCallback(10 + (processed / total) * 50); // 10-60% range
				}

				// Rate limiting for search endpoint
				await applyRateLimit();
				continue;
			}
		}

		// Card doesn't need special handling, add to regular batch
		regularCards.push(card);
	}

	// Process remaining cards in batches using the collection endpoint
	const batchSize = getBatchSize();

	for (let i = 0; i < regularCards.length; i += batchSize) {
		const batch = regularCards.slice(i, i + batchSize);

		console.log(`Processing batch ${Math.floor(i / batchSize) + 1} with ${batch.length} cards...`);

		const batchResults = await processCardBatch(batch, defaultCondition, exportOptions);
		for (const batchResult of batchResults) {
			results.push({ card: batchResult.originalCard, result: batchResult });
		}

		processed += batch.length;
		if (progressCallback) {
			progressCallback(10 + (processed / total) * 50); // 10-60% range
		}

		// Rate limiting between batches
		if (i + batchSize < regularCards.length) {
			await applyRateLimit();
		}
	}

	return results;
}

/**
 * Process a batch of cards with mixed identifiers (as Scryfall recommends)
 */
async function processCardBatch(
	cards: ParsedCard[],
	defaultCondition?: string,
	exportOptions?: ExportOptions
): Promise<ConversionResult[]> {
	// Capture parameters for use in nested callbacks
	const batchDefaultCondition = defaultCondition;
	const batchExportOptions = exportOptions;

	const cardIdentifierPairs: Array<{ card: ParsedCard; identifier: CardIdentifier }> = [];
	const cardsWithoutIdentifiers: ParsedCard[] = [];

	for (const card of cards) {
		console.log(`Processing card from row ${card.sourceRowNumber}:`, {
			name: card.name,
			language: card.language,
			edition: card.edition,
			collectorNumber: card.collectorNumber,
			multiverseId: card.multiverseId,
			scryfallId: card.scryfallId
		});

		let identifier: CardIdentifier;

		// Create identifier based on best available data (priority order)
		if (card.scryfallId) {
			// Validate and trim Scryfall ID to 36 characters
			let scryfallId = card.scryfallId.trim();
			if (scryfallId.length > 36) {
				scryfallId = scryfallId.substring(0, 36);
				card.warnings = card.warnings || [];
				card.warnings.push('Scryfall ID was longer than 36 characters and has been trimmed');
			}
			console.log(`Using Scryfall ID for ${card.name || 'unnamed card'}: ${scryfallId}`);
			identifier = { id: scryfallId };
		} else if (card.multiverseId) {
			console.log(`Using Multiverse ID for ${card.name || 'unnamed card'}: ${card.multiverseId}`);
			identifier = { multiverse_id: card.multiverseId };
		} else if (card.mtgoId) {
			console.log(`Using MTGO ID for ${card.name || 'unnamed card'}: ${card.mtgoId}`);
			identifier = { mtgo_id: card.mtgoId };
		} else if (card.edition && card.collectorNumber) {
			console.log(
				`Using Set+CN for ${card.name || 'unnamed card'}: ${card.edition}+${card.collectorNumber}`
			);
			identifier = { set: card.edition, collector_number: card.collectorNumber };
		} else if (card.name && card.edition) {
			console.log(`Using Name+Set for ${card.name}: ${card.name}+${card.edition}`);
			identifier = { name: card.name, set: card.edition };
		} else if (card.name) {
			console.log(`Using Name only for ${card.name}: ${card.name}`);
			identifier = { name: card.name };
		} else {
			// Collect cards with no valid identifiers to create failed results
			console.log(`Card with no valid identifiers: ${JSON.stringify(card.originalData)}`);
			cardsWithoutIdentifiers.push(card);
			continue;
		}

		cardIdentifierPairs.push({ card, identifier });
	}

	// Process cards with identifiers via API
	const apiResults =
		cardIdentifierPairs.length > 0
			? await processBatchWithIdentifiers(
					cardIdentifierPairs,
					batchDefaultCondition,
					batchExportOptions
				)
			: [];

	// Create failed results for cards without identifiers
	const failedResults = cardsWithoutIdentifiers.map((card) =>
		createFailedResult(card, 'No usable identifiers available for lookup')
	);

	return [...apiResults, ...failedResults];
}

/**
 * Process cards with identifiers using Collection endpoint
 */
async function processBatchWithIdentifiers(
	cardIdentifierPairs: Array<{ card: ParsedCard; identifier: CardIdentifier }>,
	defaultCondition?: string,
	exportOptions?: ExportOptions
): Promise<ConversionResult[]> {
	const results: ConversionResult[] = [];
	const batchSize = getBatchSize();

	// Process in batches of up to 75
	for (let i = 0; i < cardIdentifierPairs.length; i += batchSize) {
		const batch = cardIdentifierPairs.slice(i, i + batchSize);

		// Deduplicate identifiers and keep track of which cards map to each
		const identifierMap = new Map<string, { identifier: CardIdentifier; cards: ParsedCard[] }>();

		batch.forEach(({ card, identifier }) => {
			const identifierKey = JSON.stringify(identifier);
			if (!identifierMap.has(identifierKey)) {
				identifierMap.set(identifierKey, { identifier, cards: [] });
			}
			identifierMap.get(identifierKey)!.cards.push(card);
		});

		const uniqueIdentifiers = Array.from(identifierMap.values()).map((item) => item.identifier);

		try {
			const response = await fetchScryfallCollection(uniqueIdentifiers);

			// Match successful results back to original cards
			response.data.forEach((scryfallCard) => {
				// Find the identifier that matches this Scryfall result
				for (const [identifierKey, { identifier, cards }] of identifierMap.entries()) {
					if (isIdentifierMatch(identifier, scryfallCard)) {
						// Apply this result to ALL cards that used this identifier
						cards.forEach((originalCard) => {
							// Validate that the Scryfall data actually matches what was in the CSV
							const validation = validateScryfallMatch(originalCard, scryfallCard);

							if (!validation.isValid) {
								// Data mismatch - treat as failed lookup
								results.push(
									createFailedResult(
										originalCard,
										`Data validation failed: ${validation.errors.join('; ')}`
									)
								);
								return;
							}

							// Create successful result preserving original card properties
							const successResult = createSuccessfulResult(
								originalCard,
								scryfallCard,
								defaultCondition,
								exportOptions
							);

							// Add validation warnings if any
							if (validation.warnings && validation.warnings.length > 0) {
								const existingWarnings = successResult.warnings || [];
								successResult.warnings = [...existingWarnings, ...validation.warnings];
							}

							results.push(successResult);
						});

						// Remove this identifier from the map so we don't process it again
						identifierMap.delete(identifierKey);
						break;
					}
				}
			});

			// Handle not found cards
			response.not_found?.forEach((notFoundIdentifier) => {
				// Find cards that used this identifier
				for (const [identifierKey, { identifier, cards }] of identifierMap.entries()) {
					if (JSON.stringify(identifier) === JSON.stringify(notFoundIdentifier)) {
						cards.forEach((originalCard) => {
							results.push(createFailedResult(originalCard, 'Card not found in Scryfall database'));
						});
						identifierMap.delete(identifierKey);
						break;
					}
				}
			});

			// Rate limiting between batches
			if (i + batchSize < cardIdentifierPairs.length) {
				await applyRateLimit();
			}
		} catch (error) {
			console.error('Error in batch lookup:', error);
			// Add failed results for this batch
			batch.forEach(({ card }) => {
				results.push(createFailedResult(card, 'API error during lookup'));
			});
		}
	}

	return results;
}
