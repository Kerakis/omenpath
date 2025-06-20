import type { CsvFormat } from '../types.js';
import type { FormatModule } from '../core/formats/base.js';

// Helper function to create format modules with standard detection logic
export function createStandardFormatModule(
	format: CsvFormat,
	strongIndicators: string[] = [],
	commonIndicators: string[] = [],
	requiredHeaders: string[] = []
): FormatModule {
	return {
		format,
		detectFormat: (headers: string[]): number => {
			const headerSet = new Set(headers.map((h) => h.toLowerCase()));

			// Check required headers first
			if (requiredHeaders.length > 0) {
				const hasRequired = requiredHeaders.every((h) => headerSet.has(h));
				if (!hasRequired) return 0;
			}

			let score = 0;
			let strongMatches = 0;

			// Check strong indicators (highly weighted)
			for (const indicator of strongIndicators) {
				if (headerSet.has(indicator.toLowerCase())) {
					strongMatches++;
					score += 0.3;
				}
			}

			// Check common indicators
			for (const indicator of commonIndicators) {
				if (headerSet.has(indicator.toLowerCase())) {
					score += 0.1;
				}
			}

			// Bonus for having strong indicators
			if (strongMatches > 0) {
				score += 0.2;
			}

			return Math.min(score, 1.0);
		}
	};
}

/**
 * Parse etched foil information from different format-specific data
 */
export function parseEtchedFoil(
	formatId: string,
	rowData: Record<string, string>,
	setCode?: string,
	setName?: string
): { isEtched: boolean; cleanedSetCode?: string; cleanedSetName?: string; warnings?: string[] } {
	const warnings: string[] = [];
	let isEtched = false;
	let cleanedSetCode = setCode;
	let cleanedSetName = setName;

	switch (formatId) {
		case 'archidekt':
		case 'cubecobra':
			// Check Finish column for "Etched"
			if (rowData.Finish?.toLowerCase() === 'etched') {
				isEtched = true;
			}
			break;

		case 'cardsphere':
			// Check if set name contains "Etched Foil"
			if (setName?.includes('Etched Foil')) {
				isEtched = true;
				// Clean the set name by removing frame and etched info
				cleanedSetName = setName
					.replace(/\s+(Retro Frame|Extended Art|Borderless)?\s*Etched Foil/i, '')
					.trim();
			}
			break;

		case 'deckbox':
			// Check for _E suffix on set code and "Etched" in set name
			if (setCode?.endsWith('_E')) {
				isEtched = true;
				cleanedSetCode = setCode.slice(0, -2); // Remove _E
				warnings.push('Removed _E suffix from set code for etched foil detection');
			}
			if (setName?.endsWith(' Etched')) {
				isEtched = true;
				cleanedSetName = setName.slice(0, -7); // Remove " Etched"
			}
			break;

		case 'deckstats':
			// This format can't distinguish between foil and etched for cards that have both
			// We'll flag this as a warning if the card could be both
			break;

		case 'dragonshield':
			// Check Printing column for "Etched"
			if (rowData.Printing?.toLowerCase() === 'etched') {
				isEtched = true;
			}
			break;

		case 'helvault':
			// Check extras column for "etchedFoil"
			if (rowData.extras?.includes('etchedFoil')) {
				isEtched = true;
			}
			break;

		case 'manabox':
		case 'moxfield':
			// Check Foil column for "etched"
			if (rowData.Foil?.toLowerCase() === 'etched') {
				isEtched = true;
			}
			break;

		case 'tappedout':
			// Check Foil column for "f-etch"
			if (rowData.Foil?.toLowerCase() === 'f-etch') {
				isEtched = true;
			}
			break;

		case 'tcgplayer': {
			// Check if card name contains "(Foil Etched)"
			const cardName = rowData.Name || rowData['Product Name'] || '';
			if (cardName.includes('(Foil Etched)')) {
				isEtched = true;
			}
			break;
		}

		case 'urzasgatherer': {
			// Check "Special foil count" column - if > 0, this entry represents etched cards
			const specialFoilCount = parseInt(rowData['Special foil count'] || '0');
			if (specialFoilCount > 0) {
				isEtched = true;
			}
			break;
		}
	}

	return {
		isEtched,
		cleanedSetCode,
		cleanedSetName,
		warnings: warnings.length > 0 ? warnings : undefined
	};
}

/**
 * Parse TCGPlayer card name to remove extra information like (Foil Etched), (Extended Art), etc.
 */
export function cleanTCGPlayerCardName(cardName: string): string {
	// Remove " Art Card" suffix first (for art cards)
	let cleaned = cardName.replace(/\s+Art Card$/, '');

	// Remove " Token" suffix (for tokens)
	cleaned = cleaned.replace(/\s+Token$/, '');

	// Remove anything in parentheses and the space before it
	cleaned = cleaned.replace(/\s+\([^)]*\)/g, '').trim();

	return cleaned;
}

/**
 * Parse TCGPlayer seller condition to extract both condition and foil status
 */
export function parseTCGPlayerSellerCondition(condition: string): {
	condition: string;
	foil: string;
} {
	const foilMatch = condition.match(/^(.+?)\s+(Foil)$/i);
	if (foilMatch) {
		return {
			condition: foilMatch[1].trim(),
			foil: 'foil'
		};
	}
	return {
		condition: condition.trim(),
		foil: ''
	};
}

/**
 * Parse TCGPlayer card name to detect tokens and art cards, and adjust set codes accordingly
 */
export function parseTCGPlayerCardType(
	cardName: string,
	setCode?: string
): {
	cleanedName: string;
	adjustedSetCode?: string;
	isToken: boolean;
	isArtCard: boolean;
	warnings?: string[];
} {
	const warnings: string[] = [];
	const cleanedName = cleanTCGPlayerCardName(cardName);
	let isToken = false;
	let isArtCard = false;
	let adjustedSetCode = setCode;

	// Check for tokens
	if (cardName.includes(' Token')) {
		isToken = true;
		if (setCode && !setCode.startsWith('T')) {
			adjustedSetCode = `T${setCode}`;
			warnings.push(`Detected token card, adjusted set code from ${setCode} to ${adjustedSetCode}`);
		}
	}

	// Check for art cards
	if (cardName.includes(' Art Card')) {
		isArtCard = true;
		if (setCode && !setCode.startsWith('A')) {
			adjustedSetCode = `A${setCode}`;
			warnings.push(`Detected art card, adjusted set code from ${setCode} to ${adjustedSetCode}`);
		}
	}

	return {
		cleanedName,
		adjustedSetCode,
		isToken,
		isArtCard,
		warnings: warnings.length > 0 ? warnings : undefined
	};
}

/**
 * Detect special promo types from TCGPlayer set information
 */
export function detectTCGPlayerPromoType(
	setCode?: string,
	setName?: string
): {
	isJudgePromo: boolean;
	isPrereleasePromo: boolean;
	isPromoPackCard: boolean;
	searchQuery?: string;
} {
	const setCodeLower = setCode?.toLowerCase() || '';
	const setNameLower = setName?.toLowerCase() || '';

	// Judge Promos
	if (setCodeLower === 'jdg' || setNameLower.includes('judge promos')) {
		return {
			isJudgePromo: true,
			isPrereleasePromo: false,
			isPromoPackCard: false,
			searchQuery: 'is:judge ++'
		};
	}

	// Prerelease Promos
	if (setCodeLower === 'pre' || setNameLower.includes('prerelease')) {
		return {
			isJudgePromo: false,
			isPrereleasePromo: true,
			isPromoPackCard: false,
			searchQuery: 'is:prerelease ++'
		};
	}

	// Promo Pack Cards
	if (setNameLower.includes('promo pack:')) {
		return {
			isJudgePromo: false,
			isPrereleasePromo: false,
			isPromoPackCard: true,
			searchQuery: 'is:promopack ++'
		};
	}

	return {
		isJudgePromo: false,
		isPrereleasePromo: false,
		isPromoPackCard: false
	};
}

/**
 * Parse double-faced tokens from TCGPlayer data
 */
export function parseDoubleFacedToken(
	cardName: string,
	setCode?: string
): {
	isDoubleFacedToken: boolean;
	faces?: Array<{ name: string; collectorNumber?: string }>;
	adjustedSetCode?: string;
	warnings?: string[];
} {
	const warnings: string[] = [];

	// Check if this is a double-faced token
	const isDoubleFacedToken = cardName.includes(' // ') && cardName.includes(' Token');

	if (!isDoubleFacedToken) {
		return { isDoubleFacedToken: false };
	}

	// Add token prefix to set code
	const adjustedSetCode = setCode && !setCode.startsWith('T') ? `T${setCode}` : setCode;

	// Parse faces from different formats
	let faces: Array<{ name: string; collectorNumber?: string }> = [];

	// TCGPlayer Seller format: "Human (001) // Vampire (016) Double-Sided Token"
	const sellerMatch = cardName.match(
		/^(.+?)\s+\((\d+)\)\s+\/\/\s+(.+?)\s+\((\d+)\)\s+Double-Sided Token$/i
	);
	if (sellerMatch) {
		faces = [
			{ name: sellerMatch[1].trim(), collectorNumber: sellerMatch[2] },
			{ name: sellerMatch[3].trim(), collectorNumber: sellerMatch[4] }
		];
	} else {
		// TCGPlayer User format: "Illusion // Plant Double-sided Token"
		const userMatch = cardName.match(/^(.+?)\s+\/\/\s+(.+?)\s+Double-sided Token$/i);
		if (userMatch) {
			faces = [{ name: userMatch[1].trim() }, { name: userMatch[2].trim() }];
		}
	}

	warnings.push(
		'Double-faced token detected - Scryfall may not handle these well, treating as separate entries'
	);

	return {
		isDoubleFacedToken: true,
		faces,
		adjustedSetCode,
		warnings
	};
}
