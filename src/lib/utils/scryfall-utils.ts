/**
 * Utility functions for Scryfall API health checking and set validation
 */
import type { ScryfallCard } from '../types.js';

// Improved fuzzy string matching function with much better precision for parent sets
function fuzzyMatch(needle: string, haystack: string): number {
	if (!needle || !haystack) return 0;

	const needleLower = needle.toLowerCase().trim();
	const haystackLower = haystack.toLowerCase().trim();

	// Exact match gets perfect score
	if (needleLower === haystackLower) return 1.0;

	// Create a normalized version for edition matching
	const normalizeEdition = (text: string): string => {
		const numberMap: Record<string, string> = {
			'4th': 'fourth',
			'5th': 'fifth',
			'6th': 'sixth',
			'7th': 'seventh',
			'8th': 'eighth',
			'9th': 'ninth',
			'10th': 'tenth'
		};

		let normalized = text.toLowerCase();

		// Replace numbered forms with word forms
		for (const [num, word] of Object.entries(numberMap)) {
			normalized = normalized.replace(new RegExp(`\\b${num}\\b`, 'g'), word);
		}

		return normalized;
	};

	// Check if both are editions and normalize them for comparison
	if (needleLower.includes('edition') && haystackLower.includes('edition')) {
		const normalizedNeedle = normalizeEdition(needleLower);
		const normalizedHaystack = normalizeEdition(haystackLower);

		if (normalizedNeedle === normalizedHaystack) {
			return 1.0; // Perfect match after normalization
		}
	}

	// Special handling for "Collectors' Edition" - prevent matching with numbered editions
	if (needleLower.includes('collectors') || haystackLower.includes('collectors')) {
		if (needleLower !== haystackLower && !normalizeEdition(needleLower).includes('collectors')) {
			// Only match collectors' edition with exact matches or other collectors' variants
			return 0;
		}
	}

	// Tokenize both strings into words
	const needleWords = needleLower.split(/\s+/).filter((word) => word.length > 0);
	const haystackWords = haystackLower.split(/\s+/).filter((word) => word.length > 0);

	if (needleWords.length === 0 || haystackWords.length === 0) return 0;

	// Calculate word-based matching score
	let totalScore = 0;
	let matchedWords = 0;
	let exactWordMatches = 0;

	// Create a copy of haystack words for manipulation
	const availableHaystackWords = [...haystackWords];

	for (const needleWord of needleWords) {
		let bestWordScore = 0;
		let bestMatchIndex = -1;

		for (let i = 0; i < availableHaystackWords.length; i++) {
			const haystackWord = availableHaystackWords[i];
			let wordScore = 0;

			// Exact word match gets highest score
			if (needleWord === haystackWord) {
				wordScore = 1;
				exactWordMatches++;
			} else if (haystackWord.includes(needleWord) || needleWord.includes(haystackWord)) {
				// Partial word match
				const minLength = Math.min(needleWord.length, haystackWord.length);
				const maxLength = Math.max(needleWord.length, haystackWord.length);
				wordScore = (minLength / maxLength) * 0.8; // Penalty for partial matches
			} else {
				// Character-based similarity for remaining cases
				wordScore = characterSimilarity(needleWord, haystackWord) * 0.6;
			}

			if (wordScore > bestWordScore) {
				bestWordScore = wordScore;
				bestMatchIndex = i;
			}
		}

		if (bestWordScore > 0.3) {
			// Minimum threshold for word match
			totalScore += bestWordScore;
			matchedWords++;
			// Remove matched word to prevent double matching
			availableHaystackWords.splice(bestMatchIndex, 1);
		}
	}

	if (matchedWords === 0) return 0;

	// Base score is average of matched words
	let score = totalScore / needleWords.length;

	// Big bonus for matching all words
	if (matchedWords === needleWords.length) {
		score *= 1.2;
	}

	// Extra bonus for exact word matches
	if (exactWordMatches > 0) {
		const exactRatio = exactWordMatches / needleWords.length;
		score *= 1 + exactRatio * 0.3; // Up to 30% bonus for exact matches
	}

	// CRITICAL: Strong preference for concise matches over verbose ones
	// This helps prefer "Innistrad" over "Innistrad: Crimson Vow" when searching for "Innistrad"
	const wordCountDiff = Math.abs(needleWords.length - haystackWords.length);
	if (wordCountDiff === 0) {
		// Same word count - significant bonus
		score *= 1.4; // 40% bonus for identical word counts
	} else if (wordCountDiff === 1) {
		// Close word count - moderate bonus
		score *= 1.2; // 20% bonus for similar word counts
	} else if (wordCountDiff >= 2) {
		// Very different word counts - penalty
		score *= Math.max(0.5, 1 - wordCountDiff * 0.15); // Progressive penalty
	}

	// Additional penalty for very long haystack when needle is short
	// This specifically helps when searching "Innistrad" to prefer "Innistrad" over "Innistrad: Crimson Vow"
	if (needleWords.length <= 2 && haystackWords.length > needleWords.length + 2) {
		score *= 0.7; // Penalty for verbose matches when searching for concise terms
	}

	// Penalty for very different lengths (likely different sets)
	const lengthRatio =
		Math.min(needleLower.length, haystackLower.length) /
		Math.max(needleLower.length, haystackLower.length);
	if (lengthRatio < 0.4) {
		score *= lengthRatio;
	}

	// Special handling for "Edition" - this is a common word that shouldn't match across different editions
	if (needleLower.includes('edition') && haystackLower.includes('edition')) {
		// Check if the word before "edition" matches
		const needleEditionMatch = needleLower.match(/(\w+)\s+edition/);
		const haystackEditionMatch = haystackLower.match(/(\w+)\s+edition/);

		if (needleEditionMatch && haystackEditionMatch) {
			const needleEditionWord = needleEditionMatch[1];
			const haystackEditionWord = haystackEditionMatch[1];

			// If edition words don't match well, penalize heavily
			if (characterSimilarity(needleEditionWord, haystackEditionWord) < 0.7) {
				score *= 0.3; // Heavy penalty for different editions
			}
		}
	}

	return Math.min(score, 1);
}

// Helper function for character-level similarity
function characterSimilarity(str1: string, str2: string): number {
	if (str1 === str2) return 1;
	if (str1.length === 0 || str2.length === 0) return 0;

	const maxLength = Math.max(str1.length, str2.length);
	let commonChars = 0;

	for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
		if (str1[i] === str2[i]) {
			commonChars++;
		}
	}

	return commonChars / maxLength;
}

interface SetData {
	code: string;
	name: string;
}

let setsData: SetData[] | null = null;

// Load sets data (cached)
async function loadSetsData(): Promise<SetData[]> {
	if (setsData) return setsData;

	try {
		const response = await fetch('/data/sets.json');
		if (!response.ok) {
			throw new Error(`Failed to load sets data: ${response.status}`);
		}
		const data = await response.json();
		setsData = data;
		return data;
	} catch (error) {
		console.error('Error loading sets data:', error);
		return [];
	}
}

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

// Validate a set code against known sets
export async function validateSetCode(setCode: string): Promise<boolean> {
	if (!setCode) return false;

	const sets = await loadSetsData();
	return sets.some((set) => set.code.toLowerCase() === setCode.toLowerCase());
}

// Find the best matching set code for a set name using fuzzy matching
export async function findSetCodeByName(
	setName: string,
	threshold: number = 0.7,
	options?: {
		preferTokens?: boolean;
		preferArtSeries?: boolean;
	}
): Promise<{
	code: string | null;
	confidence: number;
	matchedName?: string;
}> {
	if (!setName) return { code: null, confidence: 0 };

	// Strip "Universes Beyond: " prefix before fuzzy matching
	const cleanedSetName = setName.replace(/^Universes Beyond:\s+/i, '').trim();

	const sets = await loadSetsData();
	let bestMatch: { set: SetData; score: number } | null = null;

	// Define comprehensive child set patterns to detect and handle appropriately
	const childSetPatterns = [
		/\s+tokens$/i,
		/\s+promos$/i,
		/\s+commander tokens$/i,
		/\s+minigames$/i,
		/\s+jumpstart front cards$/i,
		/\s+substitute cards$/i,
		/^art series:\s+/i,
		/\s+art series$/i,
		/^alchemy:\s+/i,
		/:\s+.*$/i, // Any set with a colon (like "Innistrad: Crimson Vow") - treat as child unless it's the exact match
		/remastered$/i,
		/\s+mystical archive$/i
	];

	const isChildSet = (setName: string, searchName: string): boolean => {
		// If it's an exact match, don't treat as child set
		if (setName.toLowerCase() === searchName.toLowerCase()) {
			return false;
		}

		// Check for colon patterns more carefully
		if (setName.includes(':')) {
			// If the search name also has a colon and they match exactly, don't treat as child
			if (searchName.includes(':') && setName.toLowerCase() === searchName.toLowerCase()) {
				return false;
			}
			// Otherwise, colon sets are generally child sets
			return true;
		}

		return childSetPatterns.some((pattern) => pattern.test(setName));
	};

	// Filter sets based on preferences and context
	let filteredSets = sets;
	if (options?.preferTokens) {
		// First try to find token sets (contain "Tokens" in name)
		const tokenSets = sets.filter((set) => set.name.toLowerCase().includes('tokens'));
		if (tokenSets.length > 0) {
			filteredSets = tokenSets;
		}
	} else if (options?.preferArtSeries) {
		// First try to find art series sets (contain "Art Series" in name)
		const artSets = sets.filter((set) => set.name.toLowerCase().includes('art series'));
		if (artSets.length > 0) {
			filteredSets = artSets;
		}
	}

	// Strategy: Heavily prioritize parent sets for general searches

	// First pass: Look for EXACT matches first (highest priority)
	for (const set of filteredSets) {
		if (set.name.toLowerCase() === cleanedSetName.toLowerCase()) {
			return {
				code: set.code,
				confidence: 1.0,
				matchedName: set.name
			};
		}
	}

	// Second pass: Look for parent sets (non-child sets) with massive bonuses
	if (!options?.preferTokens && !options?.preferArtSeries) {
		const parentSets = filteredSets.filter((set) => !isChildSet(set.name, cleanedSetName));

		for (const set of parentSets) {
			const score = fuzzyMatch(cleanedSetName, set.name);
			// Give MASSIVE bonus to parent sets to ensure they beat child sets
			const adjustedScore = score * 1.7; // 70% bonus for parent sets

			if (adjustedScore >= threshold && (!bestMatch || adjustedScore > bestMatch.score)) {
				bestMatch = { set, score: adjustedScore };
			}
		}

		// If we found a decent parent match, prefer it strongly
		if (bestMatch && bestMatch.score >= 0.75) {
			return {
				code: bestMatch.set.code,
				confidence: Math.min(bestMatch.score, 1.0),
				matchedName: bestMatch.set.name
			};
		}
	}

	// Third pass: Look at child sets but with heavy penalties
	if (!bestMatch || bestMatch.score < 0.9) {
		// Only do this if we don't have a very good parent match
		for (const set of filteredSets) {
			const score = fuzzyMatch(cleanedSetName, set.name);
			let adjustedScore = score;

			// Apply heavy penalty to child sets when not specifically looking for them
			if (
				!options?.preferTokens &&
				!options?.preferArtSeries &&
				isChildSet(set.name, cleanedSetName)
			) {
				adjustedScore = score * 0.4; // 60% penalty for child sets
			}

			if (adjustedScore >= threshold && (!bestMatch || adjustedScore > bestMatch.score)) {
				bestMatch = { set, score: adjustedScore };
			}
		}
	}

	// If no match found with filtered sets and we were looking for special sets,
	// fall back to searching all sets
	if (!bestMatch && (options?.preferTokens || options?.preferArtSeries)) {
		for (const set of sets) {
			const score = fuzzyMatch(cleanedSetName, set.name);
			if (score >= threshold && (!bestMatch || score > bestMatch.score)) {
				bestMatch = { set, score };
			}
		}
	}

	if (bestMatch) {
		return {
			code: bestMatch.set.code,
			confidence: Math.min(bestMatch.score, 1.0), // Ensure score doesn't exceed 1.0
			matchedName: bestMatch.set.name
		};
	}

	return { code: null, confidence: 0 };
}

// Get all known set codes (for validation)
export async function getAllSetCodes(): Promise<string[]> {
	const sets = await loadSetsData();
	return sets.map((set) => set.code);
}

// Get set name by code
export async function getSetNameByCode(code: string): Promise<string | null> {
	const sets = await loadSetsData();
	const set = sets.find((s) => s.code.toLowerCase() === code.toLowerCase());
	return set ? set.name : null;
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
