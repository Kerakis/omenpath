/**
 * Fuse.js-based fuzzy search utilities for set name matching
 * Replaces the custom fuzzy matching implementation with production-grade Fuse.js
 */
import Fuse, { type IFuseOptions, type FuseResult } from 'fuse.js/min';

interface SetData {
	code: string;
	name: string;
}

let setsData: SetData[] | null = null;
let fuseInstance: Fuse<SetData> | null = null;

// Optimal Fuse.js configuration for set name matching
const FUSE_OPTIONS: IFuseOptions<SetData> = {
	includeScore: true,
	includeMatches: false, // We don't need match highlighting for our use case
	threshold: 0.4, // More permissive than default 0.6, but not too loose
	location: 0, // Start searching from the beginning
	distance: 100, // Allow reasonable distance from start
	minMatchCharLength: 2, // Minimum 2 characters to match
	ignoreLocation: true, // Don't care about position in string
	keys: [
		{
			name: 'name',
			weight: 1.0 // Primary search field
		},
		{
			name: 'code',
			weight: 0.3 // Secondary search field (lower weight)
		}
	],
	// Advanced scoring options
	fieldNormWeight: 0.8, // Slightly reduce field-length bias to prefer parent sets
	ignoreFieldNorm: false, // Keep field-length normalization
	shouldSort: true, // Sort results by relevance
	findAllMatches: false // Stop at first good match for performance
};

// Special configuration for token/art series searches
const FUSE_OPTIONS_SPECIAL: IFuseOptions<SetData> = {
	...FUSE_OPTIONS,
	threshold: 0.3, // More strict for special searches
	fieldNormWeight: 1.2 // Increase field-length bias to prefer exact matches
};

// Load sets data and initialize Fuse instance
async function initializeFuse(): Promise<Fuse<SetData>> {
	if (fuseInstance && setsData) {
		return fuseInstance;
	}

	try {
		const response = await fetch('/data/sets.json');
		if (!response.ok) {
			throw new Error(`Failed to load sets data: ${response.status}`);
		}
		setsData = await response.json();

		// Initialize Fuse instance with the loaded data
		if (setsData) {
			fuseInstance = new Fuse(setsData, FUSE_OPTIONS);
		} else {
			throw new Error('Failed to load sets data');
		}

		return fuseInstance;
	} catch (error) {
		console.error('Error initializing Fuse.js:', error);
		throw error;
	}
}

// Clean set name before searching (handles Universes Beyond prefix, parenthetical codes, etc.)
function cleanSetName(setName: string): string {
	if (!setName) return '';

	return setName
		.replace(/^Universes Beyond:\s+/i, '') // Strip "Universes Beyond: " prefix
		.replace(/\s*\([^)]+\)\s*$/g, '') // Strip parenthetical suffixes like "(M10)", "(M11)", etc.
		.trim();
}

// Generate alternative search terms to handle word order variations
function generateSearchAlternatives(setName: string): string[] {
	if (!setName) return [];

	const alternatives = [setName]; // Always include original
	const cleaned = cleanSetName(setName);

	// Add the cleaned version if it's different from the original
	if (cleaned !== setName) {
		alternatives.push(cleaned);
	}

	// Handle parenthetical set codes (e.g., "Magic 2010 (M10)" -> "Magic 2010")
	const parentheticalMatch = setName.match(/^(.+?)\s*\([^)]+\)\s*$/);
	if (parentheticalMatch) {
		const [, baseName] = parentheticalMatch;
		const trimmedBaseName = baseName.trim();
		if (trimmedBaseName !== setName && !alternatives.includes(trimmedBaseName)) {
			alternatives.push(trimmedBaseName);
		}
	}

	// Handle "Prefix: Base Set Name" -> "Base Set Name Prefix" pattern
	const prefixMatch = cleaned.match(/^(Art Series|Commander|Alchemy):\s*(.+)$/i);
	if (prefixMatch) {
		const [, prefix, baseName] = prefixMatch;
		alternatives.push(`${baseName} ${prefix}`);
		alternatives.push(baseName); // Also try just the base name
	}

	// Handle "Art Series: Set: Subset" -> "Set Subset Art Series" pattern
	const doubleColonMatch = cleaned.match(/^(Art Series|Commander|Alchemy):\s*([^:]+):\s*(.+)$/i);
	if (doubleColonMatch) {
		const [, prefix, setName, subset] = doubleColonMatch;
		alternatives.push(`${setName}: ${subset} ${prefix}`);
		alternatives.push(`${setName} ${subset} ${prefix}`);
		alternatives.push(`${subset} ${prefix}`);
	}

	// Remove duplicates and return
	return [...new Set(alternatives)];
}

// Main fuzzy search function to replace findSetCodeByName
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
	if (!setName) {
		return { code: null, confidence: 0 };
	}

	try {
		const fuse = await initializeFuse();
		const searchAlternatives = generateSearchAlternatives(setName);

		// First, try exact matches from our alternatives, but prioritize by specificity
		if (setsData) {
			const exactMatches: Array<{ set: SetData; searchTerm: string; specificity: number }> = [];

			for (const searchTerm of searchAlternatives) {
				const match = setsData.find((set) => set.name.toLowerCase() === searchTerm.toLowerCase());
				if (match) {
					// Calculate specificity score: prefer matches with specific prefixes/suffixes
					let specificity = 0;
					if (match.name.toLowerCase().includes('art series')) specificity += 10;
					if (
						match.name.toLowerCase().includes('commander') &&
						!match.name.toLowerCase().includes('tokens')
					)
						specificity += 10;
					if (match.name.toLowerCase().includes('alchemy')) specificity += 10;
					if (match.name.toLowerCase().includes('tokens')) specificity += 5;
					if (match.name.toLowerCase().includes('promos')) specificity += 5;
					// Bonus for matches from transformed search terms (not the original)
					if (searchTerm !== setName) specificity += 15;
					// Extra bonus for exact match of original search term
					if (searchTerm === setName) specificity += 20;

					exactMatches.push({ set: match, searchTerm, specificity });
				}
			}

			if (exactMatches.length > 0) {
				// Sort by specificity (higher is better), then by search term order
				exactMatches.sort((a, b) => {
					if (a.specificity !== b.specificity) {
						return b.specificity - a.specificity; // Higher specificity first
					}
					// If same specificity, prefer order in alternatives array
					return (
						searchAlternatives.indexOf(a.searchTerm) - searchAlternatives.indexOf(b.searchTerm)
					);
				});

				const bestMatch = exactMatches[0];
				return {
					code: bestMatch.set.code,
					confidence: 1.0,
					matchedName: bestMatch.set.name
				};
			}
		}

		// If no exact match, use fuzzy search
		const useSpecialConfig = options?.preferTokens || options?.preferArtSeries;
		const allResults: Array<
			FuseResult<SetData> & { searchTerm: string; isExactAlternative: boolean }
		> = [];

		// Search with all alternatives and collect results
		for (const searchTerm of searchAlternatives) {
			let searchFuse = fuse;
			if (useSpecialConfig && setsData) {
				searchFuse = new Fuse(setsData, FUSE_OPTIONS_SPECIAL);
			}

			const results = searchFuse.search(searchTerm);
			// Add search term info to results for debugging
			const resultsWithSearchTerm = results.map((r) => ({
				...r,
				searchTerm,
				isExactAlternative: searchTerm !== setName // Mark if this came from an alternative
			}));
			allResults.push(...resultsWithSearchTerm);
		}

		if (allResults.length === 0) {
			return { code: null, confidence: 0 };
		}

		// Smart deduplication and prioritization
		const resultMap = new Map<
			string,
			FuseResult<SetData> & { searchTerm: string; isExactAlternative: boolean }
		>();

		for (const result of allResults) {
			const key = result.item.code;
			const existing = resultMap.get(key);

			if (!existing) {
				resultMap.set(key, result);
			} else {
				// Prioritize results from exact alternatives, then by score
				const shouldReplace =
					(result.isExactAlternative && !existing.isExactAlternative) ||
					(result.isExactAlternative === existing.isExactAlternative &&
						(result.score || 0) < (existing.score || 0));

				if (shouldReplace) {
					resultMap.set(key, result);
				}
			}
		}

		const uniqueResults = Array.from(resultMap.values());

		// Sort by priority: exact alternatives first, then by score
		uniqueResults.sort((a, b) => {
			if (a.isExactAlternative !== b.isExactAlternative) {
				return a.isExactAlternative ? -1 : 1; // Exact alternatives first
			}
			return (a.score || 0) - (b.score || 0); // Lower score is better
		});

		// Filter results based on preferences
		if (useSpecialConfig) {
			const filteredResults = uniqueResults.filter((result) => {
				if (options?.preferTokens && result.item.name.toLowerCase().includes('tokens')) {
					return true;
				}
				if (options?.preferArtSeries && result.item.name.toLowerCase().includes('art series')) {
					return true;
				}
				return !options?.preferTokens && !options?.preferArtSeries;
			});

			if (filteredResults.length > 0) {
				const bestMatch = filteredResults[0];
				const confidence = bestMatch.isExactAlternative ? 1.0 : 1 - (bestMatch.score || 0);

				if (confidence >= threshold) {
					return {
						code: bestMatch.item.code,
						confidence,
						matchedName: bestMatch.item.name
					};
				}
			}
		}

		// Apply parent/child set logic for non-special searches
		if (!useSpecialConfig) {
			// For "Commander: X" searches, strongly prefer "X Commander" over "X"
			if (setName.toLowerCase().startsWith('commander:')) {
				const commanderResults = uniqueResults.filter(
					(result) =>
						result.item.name.toLowerCase().includes('commander') &&
						!result.item.name.toLowerCase().includes('tokens')
				);
				if (commanderResults.length > 0) {
					const bestMatch = commanderResults[0];
					const confidence = bestMatch.isExactAlternative ? 1.0 : 1 - (bestMatch.score || 0);
					if (confidence >= threshold) {
						return {
							code: bestMatch.item.code,
							confidence,
							matchedName: bestMatch.item.name
						};
					}
				}
			}

			// For "Art Series: X" searches, strongly prefer "X Art Series" over "X"
			if (setName.toLowerCase().startsWith('art series:')) {
				const artSeriesResults = uniqueResults.filter((result) =>
					result.item.name.toLowerCase().includes('art series')
				);
				if (artSeriesResults.length > 0) {
					const bestMatch = artSeriesResults[0];
					const confidence = bestMatch.isExactAlternative ? 1.0 : 1 - (bestMatch.score || 0);
					if (confidence >= threshold) {
						return {
							code: bestMatch.item.code,
							confidence,
							matchedName: bestMatch.item.name
						};
					}
				}
			}
		}

		// Default: return best match
		const bestMatch = uniqueResults[0];
		const confidence = bestMatch.isExactAlternative ? 1.0 : 1 - (bestMatch.score || 0);

		if (confidence >= threshold) {
			return {
				code: bestMatch.item.code,
				confidence,
				matchedName: bestMatch.item.name
			};
		}

		return { code: null, confidence: 0 };
	} catch (error) {
		console.error('Error in fuzzy set name search:', error);
		return { code: null, confidence: 0 };
	}
}

// Utility function to validate a set code (keep existing functionality)
export async function validateSetCode(setCode: string): Promise<boolean> {
	if (!setCode) return false;

	if (!setsData) {
		await initializeFuse(); // This will load setsData
	}

	return setsData!.some((set) => set.code.toLowerCase() === setCode.toLowerCase());
}

// Get all known set codes (keep existing functionality)
export async function getAllSetCodes(): Promise<string[]> {
	if (!setsData) {
		await initializeFuse(); // This will load setsData
	}

	return setsData!.map((set) => set.code);
}

// Get set name by code (keep existing functionality)
export async function getSetNameByCode(code: string): Promise<string | null> {
	if (!setsData) {
		await initializeFuse(); // This will load setsData
	}

	const set = setsData!.find((s) => s.code.toLowerCase() === code.toLowerCase());
	return set ? set.name : null;
}
