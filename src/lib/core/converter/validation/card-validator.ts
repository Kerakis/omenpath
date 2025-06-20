import type { ParsedCard, ScryfallCard } from '../../../types.js';

/**
 * Parse Archidekt tags for proxy/signed/altered status
 */
export function parseArchidektTags(tags: string): { proxy: string; signed: string; alter: string } {
	if (!tags) return { proxy: 'FALSE', signed: 'FALSE', alter: 'FALSE' };

	const tagList = tags
		.toLowerCase()
		.split(',')
		.map((tag) => tag.trim());

	// Check for proxy indicators
	const isProxy = tagList.some((tag) => tag.includes('proxy') || tag.includes('proxies'));

	// Check for signed indicators
	const isSigned = tagList.some((tag) => tag.includes('signed'));

	// Check for altered/custom art indicators
	const isAltered = tagList.some(
		(tag) =>
			tag.includes('alter') ||
			tag.includes('altered') ||
			tag.includes('custom') ||
			tag === 'custom art'
	);

	return {
		proxy: isProxy ? 'TRUE' : 'FALSE',
		signed: isSigned ? 'TRUE' : 'FALSE',
		alter: isAltered ? 'TRUE' : 'FALSE'
	};
}

/**
 * Validation function to check if Scryfall data matches original CSV data
 */
export function validateScryfallMatch(
	originalCard: ParsedCard,
	scryfallCard: ScryfallCard
): { isValid: boolean; errors: string[]; warnings: string[] } {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Validate name match (only if name was provided in original)
	// Allow for dual-faced card (DFC) flexibility
	if (originalCard.name && originalCard.name.trim() !== '') {
		let nameMatches = false;
		const originalNameLower = originalCard.name.toLowerCase().trim();
		const scryfallNameLower = scryfallCard.name.toLowerCase().trim();

		// Direct match
		if (originalNameLower === scryfallNameLower) {
			nameMatches = true;
		} else {
			// Check for dual-faced card flexibility
			// Either the Scryfall card is a DFC and original matches one face,
			// or the original might be a DFC and Scryfall matches one face
			if (scryfallCard.name.includes(' // ')) {
				// Scryfall card is DFC, check if original matches either face
				const faces = scryfallCard.name.split(' // ').map((face) => face.trim().toLowerCase());
				nameMatches = faces.some((face) => face === originalNameLower);
			} else if (originalCard.name.includes(' // ')) {
				// Original is DFC, check if Scryfall matches either face
				const faces = originalCard.name.split(' // ').map((face) => face.trim().toLowerCase());
				nameMatches = faces.some((face) => face === scryfallNameLower);
			}
		}

		if (!nameMatches) {
			errors.push(`Name mismatch: expected "${originalCard.name}", got "${scryfallCard.name}"`);
		}
	}

	// Validate set code match (if provided in original)
	if (
		originalCard.edition &&
		originalCard.edition.toLowerCase() !== scryfallCard.set.toLowerCase()
	) {
		errors.push(`Set code mismatch: expected "${originalCard.edition}", got "${scryfallCard.set}"`);
	}

	// Validate collector number match (if provided in original)
	if (
		originalCard.collectorNumber &&
		originalCard.collectorNumber !== scryfallCard.collector_number
	) {
		errors.push(
			`Collector number mismatch: expected "${originalCard.collectorNumber}", got "${scryfallCard.collector_number}"`
		);
	}

	// Validate foil/finish availability (if specified in original)
	if (originalCard.foil && originalCard.foil.trim() !== '') {
		const normalizedFinish = originalCard.foil.toLowerCase().trim();
		const availableFinishes = scryfallCard.finishes?.map((f) => f.toLowerCase()) || [];

		// Map common finish names to Scryfall's format
		let expectedFinish: string;
		if (
			normalizedFinish === 'foil' ||
			normalizedFinish === 'yes' ||
			normalizedFinish === 'true' ||
			normalizedFinish === '1'
		) {
			expectedFinish = 'foil';
		} else if (
			normalizedFinish === 'normal' ||
			normalizedFinish === 'nonfoil' ||
			normalizedFinish === 'no' ||
			normalizedFinish === 'false' ||
			normalizedFinish === '0'
		) {
			expectedFinish = 'nonfoil';
		} else if (normalizedFinish === 'etched') {
			expectedFinish = 'etched';
		} else {
			// For any other values, try to match directly
			expectedFinish = normalizedFinish;
		}

		if (!availableFinishes.includes(expectedFinish)) {
			// For etched foil detected from name, treat as warning rather than error
			if (expectedFinish === 'etched') {
				warnings.push(
					`Etched foil detected from name but not available in Scryfall (available: ${scryfallCard.finishes?.join(', ') || 'none'})`
				);
			} else {
				errors.push(
					`Finish not available: "${originalCard.foil}" not available for this card (available: ${scryfallCard.finishes?.join(', ') || 'none'})`
				);
			}
		}
	}

	// NOTE: Language validation is now handled separately in performLanguageValidationAndSecondaryLookups
	// We don't validate language match here to avoid failing cards that could be corrected via Search API

	return {
		isValid: errors.length === 0,
		errors,
		warnings
	};
}
