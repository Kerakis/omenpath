// Language mapping based on Scryfall documentation
const LANGUAGE_MAPPINGS: Record<string, string[]> = {
	en: ['en', 'english', 'eng'],
	es: ['es', 'sp', 'spanish', 'español', 'espanol'],
	fr: ['fr', 'french', 'français', 'francais'],
	de: ['de', 'german', 'deutsch'],
	it: ['it', 'italian', 'italiano'],
	pt: ['pt', 'portuguese', 'português', 'portugues'],
	ja: ['ja', 'jp', 'japanese', '日本語', 'nihongo'],
	ko: ['ko', 'kr', 'korean', '한국어', 'hangukeo'],
	ru: ['ru', 'russian', 'русский', 'russkiy'],
	zhs: ['zhs', 'cs', 'chinese simplified', 'simplified chinese', '简体中文', 'jianti'],
	zht: ['zht', 'ct', 'chinese traditional', 'traditional chinese', '繁體中文', 'fanti'],
	he: ['he', 'hebrew', 'עברית', 'ivrit'],
	la: ['la', 'latin'],
	grc: ['grc', 'ancient greek', 'greek', 'ελληνικά'],
	ar: ['ar', 'arabic', 'العربية'],
	sa: ['sa', 'sanskrit', 'संस्कृत'],
	ph: ['ph', 'phyrexian'],
	qya: ['qya', 'quenya']
};

/**
 * Normalize and validate language matches
 */
export function validateLanguageMatch(originalLanguage: string, scryfallLanguage: string): boolean {
	if (!originalLanguage || !scryfallLanguage) {
		return true; // If either is missing, don't validate
	}

	const normalizedOriginal = originalLanguage.toLowerCase().trim();
	const normalizedScryfall = scryfallLanguage.toLowerCase().trim();

	// Direct match
	if (normalizedOriginal === normalizedScryfall) {
		return true;
	}

	// Check if both languages map to the same Scryfall language code
	for (const [scryfallCode, aliases] of Object.entries(LANGUAGE_MAPPINGS)) {
		const originalMatches = aliases.some((alias) => alias.toLowerCase() === normalizedOriginal);
		const scryfallMatches =
			scryfallCode === normalizedScryfall ||
			aliases.some((alias) => alias.toLowerCase() === normalizedScryfall);

		if (originalMatches && scryfallMatches) {
			return true;
		}
	}

	return false;
}

/**
 * Convert Scryfall language code to display name
 */
export function getLanguageDisplayName(scryfallLanguageCode: string): string {
	const languageNames: Record<string, string> = {
		en: 'English',
		es: 'Spanish',
		fr: 'French',
		de: 'German',
		it: 'Italian',
		pt: 'Portuguese',
		ja: 'Japanese',
		ko: 'Korean',
		ru: 'Russian',
		zhs: 'Chinese Simplified',
		zht: 'Chinese Traditional',
		he: 'Hebrew',
		la: 'Latin',
		grc: 'Ancient Greek',
		ar: 'Arabic',
		sa: 'Sanskrit',
		ph: 'Phyrexian',
		qya: 'Quenya'
	};

	return languageNames[scryfallLanguageCode.toLowerCase()] || scryfallLanguageCode;
}

/**
 * Check if a language is recognized (for preview warnings)
 */
export function isLanguageRecognized(language: string): boolean {
	if (!language || language.trim() === '') return true; // Empty is fine

	const normalizedLanguage = language.toLowerCase().trim();

	// Check if it matches any known language code or alias
	for (const [scryfallCode, aliases] of Object.entries(LANGUAGE_MAPPINGS)) {
		if (
			scryfallCode === normalizedLanguage ||
			aliases.some((alias) => alias.toLowerCase() === normalizedLanguage)
		) {
			return true;
		}
	}

	return false;
}

/**
 * Get Scryfall language code from various input formats
 */
export function getScryfallLanguageCode(inputLanguage: string): string | null {
	if (!inputLanguage || inputLanguage.trim() === '') {
		return null;
	}

	const normalizedInput = inputLanguage.toLowerCase().trim();

	// Check if input is already a valid Scryfall language code
	if (Object.keys(LANGUAGE_MAPPINGS).includes(normalizedInput)) {
		return normalizedInput;
	}

	// Find matching Scryfall language code from aliases
	for (const [scryfallCode, aliases] of Object.entries(LANGUAGE_MAPPINGS)) {
		if (aliases.some((alias) => alias.toLowerCase() === normalizedInput)) {
			return scryfallCode;
		}
	}

	return null; // Unknown language
}

/**
 * Check if there is a true language mismatch (different languages) vs just alias differences
 * Returns true if the languages are truly different (e.g., Japanese vs English)
 * Returns false if they're the same language with different aliases (e.g., 'jp' vs 'ja')
 */
export function isTrueLanguageMismatch(
	originalLanguage: string,
	scryfallLanguage: string
): boolean {
	if (!originalLanguage || !scryfallLanguage) {
		return false; // No mismatch if either is missing
	}

	const normalizedOriginal = originalLanguage.toLowerCase().trim();
	const normalizedScryfall = scryfallLanguage.toLowerCase().trim();

	// Direct match - no mismatch
	if (normalizedOriginal === normalizedScryfall) {
		return false;
	}

	// Get the Scryfall language codes for both inputs
	const originalCode = getScryfallLanguageCode(normalizedOriginal);
	const scryfallCode = getScryfallLanguageCode(normalizedScryfall);

	// If we can't identify either language, assume it's a mismatch to be safe
	if (!originalCode || !scryfallCode) {
		return true;
	}

	// If both map to the same language code, it's just an alias difference
	if (originalCode === scryfallCode) {
		return false;
	}

	// Different language codes = true language mismatch
	return true;
}
