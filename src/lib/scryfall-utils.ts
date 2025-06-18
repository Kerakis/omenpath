/**
 * Utility functions for Scryfall API health checking and set validation
 */

// Simple fuzzy string matching function
function fuzzyMatch(needle: string, haystack: string): number {
	if (!needle || !haystack) return 0;

	const needleLower = needle.toLowerCase().trim();
	const haystackLower = haystack.toLowerCase().trim();

	// Exact match
	if (needleLower === haystackLower) return 1;

	// Simple similarity score based on common characters and length
	const maxLength = Math.max(needleLower.length, haystackLower.length);
	const minLength = Math.min(needleLower.length, haystackLower.length);

	// If length difference is too great, low score
	if (minLength / maxLength < 0.5) return 0;

	// Count common characters in sequence
	let commonChars = 0;
	let i = 0,
		j = 0;

	while (i < needleLower.length && j < haystackLower.length) {
		if (needleLower[i] === haystackLower[j]) {
			commonChars++;
			i++;
			j++;
		} else {
			// Try advancing both pointers to find next match
			const nextI = needleLower.indexOf(haystackLower[j], i);
			const nextJ = haystackLower.indexOf(needleLower[i], j);

			if (nextI !== -1 && (nextJ === -1 || nextI - i <= nextJ - j)) {
				i = nextI;
			} else if (nextJ !== -1) {
				j = nextJ;
			} else {
				i++;
				j++;
			}
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
	threshold: number = 0.7
): Promise<{
	code: string | null;
	confidence: number;
	matchedName?: string;
}> {
	if (!setName) return { code: null, confidence: 0 };

	const sets = await loadSetsData();
	let bestMatch: { set: SetData; score: number } | null = null;
	for (const set of sets) {
		const score = fuzzyMatch(setName, set.name);
		if (score >= threshold && (!bestMatch || score > bestMatch.score)) {
			bestMatch = { set, score };
		}
	}

	if (bestMatch) {
		return {
			code: bestMatch.set.code,
			confidence: bestMatch.score,
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
