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

	const batchSize = getBatchSize();

	// Process cards that need lookup in batches of 75, mixing all identifier types as Scryfall recommends
	for (let i = 0; i < cardsNeedingLookup.length; i += batchSize) {
		const batch = cardsNeedingLookup.slice(i, i + batchSize);

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
		if (i + batchSize < cardsNeedingLookup.length) {
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
							results.push(
								createSuccessfulResult(originalCard, scryfallCard, defaultCondition, exportOptions)
							);
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
