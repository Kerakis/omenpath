import type { ParsedCard } from '../../../types.js';
import { searchCardByNameAndCollector } from '../api/scryfall-api.js';

/**
 * Handle special case of name + collector number (no set)
 * Attempts to find the correct set via Scryfall search
 */
export async function performNameAndCollectorNumberLookups(
	cards: ParsedCard[]
): Promise<{ processedCards: ParsedCard[]; nameOnlyCards: ParsedCard[] }> {
	const processedCards: ParsedCard[] = [];
	const nameOnlyCards: ParsedCard[] = [];

	for (const card of cards) {
		// Check if this card has name + collector number but no set AND no other identifiers
		// Cards with existing Scryfall ID, Multiverse ID, or MTGO ID should skip this lookup
		if (
			card.name &&
			card.collectorNumber &&
			!card.edition &&
			!card.editionName &&
			!card.scryfallId &&
			!card.multiverseId &&
			!card.mtgoId
		) {
			console.log(
				`Attempting name + collector number lookup for: ${card.name} (CN: ${card.collectorNumber})`
			);

			try {
				const scryfallCard = await searchCardByNameAndCollector(card.name, card.collectorNumber);

				if (scryfallCard) {
					console.log(
						`Found unique match for ${card.name}: ${scryfallCard.set} ${scryfallCard.collector_number}`
					);

					// Update the card with the found set information and store the full Scryfall data
					const updatedCard: ParsedCard = {
						...card,
						edition: scryfallCard.set,
						scryfallId: scryfallCard.id,
						initialConfidence: 'medium' as const, // Medium confidence for name+collector# search
						foundViaNameCollectorSearch: true, // Flag to indicate special search method
						scryfallCardData: scryfallCard, // Store the full Scryfall card data
						warnings: [
							...(card.warnings || []),
							`Found set "${scryfallCard.set}" via name + collector number search`
						]
					};
					processedCards.push(updatedCard);
				} else {
					console.log(
						`Multiple or no results for ${card.name} CN:${card.collectorNumber}, falling back to name-only`
					);

					// Multiple results or no results - fall back to name-only lookup
					nameOnlyCards.push({
						...card,
						initialConfidence: 'low' as const,
						warnings: [
							...(card.warnings || []),
							'Name + collector number search returned multiple/no results, using name-only lookup'
						]
					});
				}
			} catch (error) {
				console.log(`Error during name + collector number search for ${card.name}:`, error);

				// Error occurred - fall back to name-only lookup
				nameOnlyCards.push({
					...card,
					initialConfidence: 'low' as const,
					warnings: [
						...(card.warnings || []),
						'Name + collector number search error, using name-only lookup'
					]
				});
			}
		} else {
			// Card doesn't match the special case criteria
			processedCards.push(card);
		}
	}

	return { processedCards, nameOnlyCards };
}
