/**
 * Utility functions for Scryfall API health checking and set validation
 * Now uses Fuse.js for robust fuzzy matching
 */
import type { ScryfallCard } from '../types.js';
import {
	findSetCodeByName as fuseSearch,
	validateSetCode as fuseValidateSetCode,
	getAllSetCodes as fuseGetAllSetCodes,
	getSetNameByCode as fuseGetSetNameByCode
} from './fuse-search.js';

// Re-export Fuse.js functions with original names for backward compatibility
export const findSetCodeByName = fuseSearch;
export const validateSetCode = fuseValidateSetCode;
export const getAllSetCodes = fuseGetAllSetCodes;
export const getSetNameByCode = fuseGetSetNameByCode;

// Check if Scryfall API is available
export async function checkScryfallApiHealth(): Promise<{ available: boolean; error?: string }> {
	try {
		const response = await fetch('https://api.scryfall.com/sets/lea', {
			headers: {
				'User-Agent': 'OmenPath/1.0'
			}
		});

		if (response.ok) {
			return { available: true };
		} else {
			return {
				available: false,
				error: `API returned status ${response.status}`
			};
		}
	} catch (error) {
		return {
			available: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Search Scryfall for cards using special queries (Judge, Prerelease, Promo Pack)
 */
export async function searchScryfallCards(
	cardName: string,
	searchQuery: string,
	options?: {
		maxResults?: number;
		includeExtras?: boolean;
	}
): Promise<{
	cards: ScryfallCard[];
	totalResults: number;
	hasMore: boolean;
	warnings?: string[];
}> {
	const warnings: string[] = [];
	const maxResults = options?.maxResults || 10;
	const includeExtras = options?.includeExtras || false;

	try {
		// Construct the search query
		// Format: "card name" + special search query
		const fullQuery = `"${cardName}" ${searchQuery}`;

		// If includeExtras is false, exclude non-game cards
		const finalQuery = includeExtras ? fullQuery : `${fullQuery} -is:extra`;

		const encodedQuery = encodeURIComponent(finalQuery);
		const url = `https://api.scryfall.com/cards/search?q=${encodedQuery}&order=released&unique=prints`;

		const response = await fetch(url, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'User-Agent': 'OmenPath/1.0'
			}
		});

		if (!response.ok) {
			if (response.status === 404) {
				// No cards found
				return {
					cards: [],
					totalResults: 0,
					hasMore: false,
					warnings: [
						`No ${searchQuery.replace('is:', '').replace(' ++', '')} versions found for "${cardName}"`
					]
				};
			}
			throw new Error(`Search failed with status ${response.status}`);
		}

		const data = await response.json();

		// Check if we have results
		if (!data.data || data.data.length === 0) {
			return {
				cards: [],
				totalResults: 0,
				hasMore: false,
				warnings: [
					`No ${searchQuery.replace('is:', '').replace(' ++', '')} versions found for "${cardName}"`
				]
			};
		}

		// Limit results if requested
		const cards = data.data.slice(0, maxResults);

		// Add confidence warnings based on search type
		if (searchQuery.includes('is:judge')) {
			warnings.push('Found judge promo version(s) - verify this is the correct printing');
		} else if (searchQuery.includes('is:prerelease')) {
			warnings.push('Found prerelease promo version(s) - verify this is the correct printing');
		} else if (searchQuery.includes('is:promopack')) {
			warnings.push('Found promo pack version(s) - verify this is the correct printing');
		}

		return {
			cards,
			totalResults: data.total_cards || cards.length,
			hasMore: data.has_more || false,
			warnings: warnings.length > 0 ? warnings : undefined
		};
	} catch (error) {
		console.error('Scryfall search error:', error);
		return {
			cards: [],
			totalResults: 0,
			hasMore: false,
			warnings: [`Search error: ${error instanceof Error ? error.message : 'Unknown error'}`]
		};
	}
}
