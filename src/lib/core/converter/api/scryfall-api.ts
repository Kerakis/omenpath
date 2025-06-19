import type { CardIdentifier, ScryfallResponse, ScryfallCard } from '../../../types.js';

// Rate limiting for Scryfall API (max 10 requests per second)
const RATE_LIMIT_DELAY = 100; // 100ms between requests
const BATCH_SIZE = 75; // Scryfall collection endpoint limit

// Scryfall API functions
async function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch cards from Scryfall Collection endpoint
 */
export async function fetchScryfallCollection(
	identifiers: CardIdentifier[]
): Promise<ScryfallResponse> {
	try {
		console.log(`Making Scryfall API request for ${identifiers.length} cards`);

		const response = await fetch('https://api.scryfall.com/cards/collection', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'Omenpath/1.0',
				Accept: 'application/json'
			},
			body: JSON.stringify({
				identifiers: identifiers.slice(0, BATCH_SIZE)
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Scryfall API error: ${response.status} ${response.statusText}`, errorText);
			throw new Error(`Scryfall API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		console.log(
			`Scryfall API response: found ${data.data?.length || 0}, not found ${data.not_found?.length || 0}`
		);

		return data;
	} catch (error) {
		console.error('Network error during Scryfall API request', error);
		throw new Error('Network error communicating with Scryfall API');
	}
}

/**
 * Fetch card using Search endpoint with specific language
 */
export async function fetchScryfallCardByLanguage(
	setCode: string,
	collectorNumber: string,
	languageCode: string
): Promise<ScryfallCard | null> {
	try {
		const query = `e:${setCode} cn:${collectorNumber} lang:${languageCode}`;
		const encodedQuery = encodeURIComponent(query);
		const url = `https://api.scryfall.com/cards/search?q=${encodedQuery}`;

		console.log(`Searching for card with language: ${url}`);

		const response = await fetch(url, {
			headers: {
				'User-Agent': 'Omenpath/1.0',
				Accept: 'application/json'
			}
		});

		if (!response.ok) {
			if (response.status === 404) {
				// No cards found - this is expected for language mismatches
				console.log(`No cards found for language query: ${query}`);
				return null;
			}

			const errorText = await response.text();
			console.error(
				`Scryfall Search API error: ${response.status} ${response.statusText}`,
				errorText
			);
			throw new Error(`Scryfall Search API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();

		if (data.data && data.data.length > 0) {
			console.log(`Found ${data.data.length} card(s) for language query`);
			return data.data[0]; // Return first match
		}

		return null;
	} catch (error) {
		console.error('Error fetching card by language:', error);
		throw error;
	}
}

/**
 * Search for card using name and collector number
 */
export async function searchCardByNameAndCollector(
	name: string,
	collectorNumber: string
): Promise<ScryfallCard | null> {
	try {
		// Search for exact card name with collector number using search endpoint
		const searchQuery = `!"${name}" cn:${collectorNumber}`;
		const encodedQuery = encodeURIComponent(searchQuery);
		const searchUrl = `https://api.scryfall.com/cards/search?q=${encodedQuery}`;

		console.log(`Search URL: ${searchUrl}`);

		const response = await fetch(searchUrl);
		await delay(RATE_LIMIT_DELAY); // Rate limiting

		if (response.ok) {
			const searchResult = await response.json();

			// Only use result if exactly one card is returned
			if (searchResult.data && searchResult.data.length === 1) {
				return searchResult.data[0];
			}
		}

		return null;
	} catch (error) {
		console.error('Error in name+collector search:', error);
		return null;
	}
}

/**
 * Apply rate limiting delay
 */
export async function applyRateLimit(): Promise<void> {
	await delay(RATE_LIMIT_DELAY);
}

/**
 * Get batch size for Collection endpoint requests
 */
export function getBatchSize(): number {
	return BATCH_SIZE;
}

/**
 * Helper function to check if an identifier matches a Scryfall card
 */
export function isIdentifierMatch(identifier: CardIdentifier, scryfallCard: ScryfallCard): boolean {
	if (identifier.id && scryfallCard.id === identifier.id.trim().substring(0, 36)) {
		return true;
	}
	if (identifier.multiverse_id && scryfallCard.multiverse_ids?.includes(identifier.multiverse_id)) {
		return true;
	}
	if (
		identifier.mtgo_id &&
		(scryfallCard.mtgo_id === identifier.mtgo_id ||
			scryfallCard.mtgo_foil_id === identifier.mtgo_id)
	) {
		return true;
	}
	if (identifier.set && identifier.collector_number) {
		return (
			scryfallCard.set.toLowerCase() === identifier.set.toLowerCase() &&
			scryfallCard.collector_number === identifier.collector_number
		);
	}
	if (identifier.name && identifier.set) {
		return (
			scryfallCard.name.toLowerCase() === identifier.name.toLowerCase() &&
			scryfallCard.set.toLowerCase() === identifier.set.toLowerCase()
		);
	}
	if (identifier.name) {
		return scryfallCard.name.toLowerCase() === identifier.name.toLowerCase();
	}
	return false;
}
