import type { CardIdentifier, ScryfallResponse, ScryfallCard } from '../../../types.js';

// Scryfall API rate limits (https://scryfall.com/docs/api/rate-limits):
// /cards/search, /cards/named, /cards/random, /cards/collection — 2/second (500ms)
// All other endpoints — 10/second (100ms)
const SEARCH_COLLECTION_DELAY_MS = 500;
const RATE_LIMIT_429_BACKOFF_MS = 32_000; // 30s Scryfall penalty + 2s buffer
const BATCH_SIZE = 75; // Scryfall /cards/collection endpoint limit per request

// Multiplied against SEARCH_COLLECTION_DELAY_MS after each HTTP 429 (capped at 8×)
let rateLimitMultiplier = 1;

const SCRYFALL_HEADERS = {
	'User-Agent': 'Omenpath/1.0',
	Accept: 'application/json'
} as const;

async function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch wrapper with HTTP 429 retry handling.
 * On a 429, waits the 30-second Scryfall penalty period then retries once.
 * Each 429 also doubles rateLimitMultiplier (capped at 8×) to slow future requests.
 * Exported so other Scryfall utility modules can share the same retry behaviour.
 */
export async function fetchWithRetry(
	url: string,
	options: RequestInit,
	attempt = 0
): Promise<Response> {
	const response = await fetch(url, options);

	if (response.status === 429) {
		if (attempt >= 1) {
			console.error('Scryfall API returned 429 after retry — aborting to avoid ban.');
			return response;
		}
		rateLimitMultiplier = Math.min(rateLimitMultiplier * 2, 8);
		console.warn(
			`Scryfall rate limit hit (429). Waiting ${RATE_LIMIT_429_BACKOFF_MS / 1000}s before retry...`
		);
		await delay(RATE_LIMIT_429_BACKOFF_MS);
		return fetchWithRetry(url, options, attempt + 1);
	}

	return response;
}

/**
 * Fetch cards from Scryfall /cards/collection endpoint.
 * Callers are responsible for applying rate limits between consecutive batch calls.
 */
export async function fetchScryfallCollection(
	identifiers: CardIdentifier[]
): Promise<ScryfallResponse> {
	console.log(`Making Scryfall API request for ${identifiers.length} cards`);

	let response: Response;
	try {
		response = await fetchWithRetry('https://api.scryfall.com/cards/collection', {
			method: 'POST',
			headers: {
				...SCRYFALL_HEADERS,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ identifiers: identifiers.slice(0, BATCH_SIZE) })
		});
	} catch (error) {
		console.error('Network error during Scryfall API request', error);
		throw new Error('Network error communicating with Scryfall API', { cause: error });
	}

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
}

/**
 * Fetch a card from /cards/search using set, collector number, and language.
 * Callers are responsible for applying rate limits between consecutive calls.
 */
export async function fetchScryfallCardByLanguage(
	setCode: string,
	collectorNumber: string,
	languageCode: string
): Promise<ScryfallCard | null> {
	const query = `e:${setCode} cn:${collectorNumber} lang:${languageCode}`;
	const encodedQuery = encodeURIComponent(query);
	const url = `https://api.scryfall.com/cards/search?q=${encodedQuery}`;

	console.log(`Searching for card with language: ${url}`);

	let response: Response;
	try {
		response = await fetchWithRetry(url, { headers: SCRYFALL_HEADERS });
	} catch (error) {
		console.error('Error fetching card by language:', error);
		throw error;
	}

	if (!response.ok) {
		if (response.status === 404) {
			// No cards found — expected for language mismatches
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
}

/**
 * Search /cards/search for a card by exact name and collector number.
 * Applies a post-request rate-limit delay so loops calling this function
 * automatically respect the 2 req/sec limit without external throttling.
 */
export async function searchCardByNameAndCollector(
	name: string,
	collectorNumber: string
): Promise<ScryfallCard | null> {
	const searchQuery = `!"${name}" cn:${collectorNumber}`;
	const encodedQuery = encodeURIComponent(searchQuery);
	const searchUrl = `https://api.scryfall.com/cards/search?q=${encodedQuery}`;

	console.log(`Search URL: ${searchUrl}`);

	try {
		const response = await fetchWithRetry(searchUrl, { headers: SCRYFALL_HEADERS });
		let result: ScryfallCard | null = null;

		if (response.ok) {
			const searchResult = await response.json();
			// Only use result if exactly one card is returned
			if (searchResult.data && searchResult.data.length === 1) {
				result = searchResult.data[0];
			}
		}

		// Post-request delay: throttles the next call when used in a loop
		await delay(SEARCH_COLLECTION_DELAY_MS * rateLimitMultiplier);
		return result;
	} catch (error) {
		console.error('Error in name+collector search:', error);
		return null;
	}
}

/**
 * Apply the rate-limit delay for /cards/search and /cards/collection endpoints (500ms min).
 * Call this between consecutive requests to those endpoints.
 */
export async function applyRateLimit(): Promise<void> {
	await delay(SEARCH_COLLECTION_DELAY_MS * rateLimitMultiplier);
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
