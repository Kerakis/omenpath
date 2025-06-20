import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';
import {
	cleanTCGPlayerCardName,
	parseTCGPlayerSellerCondition,
	parseTCGPlayerCardType,
	detectTCGPlayerPromoType,
	parseDoubleFacedToken
} from '../../utils/format-helpers.js';

// Language normalization for TCGPlayer
function normalizeLanguage(value: string): string {
	if (!value) return 'English';
	const normalized = value.toLowerCase().trim();
	switch (normalized) {
		case 'chinese (t)':
		case 'chinese (traditional)':
			return 'Chinese Traditional';
		case 'chinese (s)':
		case 'chinese (simplified)':
			return 'Chinese Simplified';
		case 'english':
		case 'en':
			return 'English';
		case 'japanese':
		case 'jp':
		case 'ja':
			return 'Japanese';
		case 'french':
		case 'fr':
			return 'French';
		case 'german':
		case 'de':
			return 'German';
		case 'italian':
		case 'it':
			return 'Italian';
		case 'portuguese':
		case 'pt':
			return 'Portuguese';
		case 'russian':
		case 'ru':
			return 'Russian';
		case 'spanish':
		case 'es':
			return 'Spanish';
		case 'korean':
		case 'ko':
			return 'Korean';
		default:
			return value; // Return as-is if not recognized
	}
}

// TCGPlayer User format (what regular users see)
export const tcgPlayerUser: CsvFormat = {
	name: 'TCGPlayer (User)',
	id: 'tcgplayer-user',
	description: 'TCGPlayer collection export (User format)',
	hasHeaders: true,
	columnMappings: {
		count: 'Quantity',
		name: 'Simple Name', // Use Simple Name as it's cleaner than Name
		edition: 'Set Code', // Set Code is more standardized than Set
		editionName: 'Set', // Full set name for reference
		collectorNumber: 'Card Number',
		condition: 'Condition',
		language: 'Language',
		foil: 'Printing',
		rarity: 'Rarity',
		productId: 'Product ID',
		sku: 'SKU'
	},
	transformations: {
		condition: (value: string) => value.trim(),
		language: normalizeLanguage,
		foil: (value: string, row?: Record<string, string>) => {
			// Check if card name contains "(Foil Etched)" - this takes precedence
			const cardName = row?.Name || '';
			if (cardName.includes('(Foil Etched)')) {
				return 'etched';
			}
			// Otherwise, check the finish column
			return value.toLowerCase() === 'foil' ? 'foil' : '';
		},
		name: (value: string) => cleanTCGPlayerCardName(value) // Clean card name from Full Name field if needed
	}
};

// TCGPlayer Seller format (what sellers see)
export const tcgPlayerSeller: CsvFormat = {
	name: 'TCGPlayer (Seller)',
	id: 'tcgplayer-seller',
	description: 'TCGPlayer collection export (Seller format)',
	hasHeaders: true,
	columnMappings: {
		count: 'Total Quantity',
		name: 'Product Name',
		editionName: 'Set Name',
		condition: 'Condition',
		rarity: 'Rarity',
		tcgplayerId: 'TCGplayer Id',
		productLine: 'Product Line',
		number: 'Number',
		title: 'Title',
		tcgMarketPrice: 'TCG Market Price',
		tcgDirectLow: 'TCG Direct Low',
		tcgLowPriceWithShipping: 'TCG Low Price With Shipping',
		tcgLowPrice: 'TCG Low Price',
		addToQuantity: 'Add to Quantity',
		tcgMarketplacePrice: 'TCG Marketplace Price',
		photoUrl: 'Photo URL'
	},
	transformations: {
		name: (value: string) => cleanTCGPlayerCardName(value),
		condition: (value: string) => {
			const parsed = parseTCGPlayerSellerCondition(value);
			return parsed.condition;
		},
		// Extract foil information from condition for seller format
		foil: (value: string, row?: Record<string, string>) => {
			// Check if product name contains "(Foil Etched)" - this takes precedence
			const productName = row?.['Product Name'] || '';
			if (productName.includes('(Foil Etched)')) {
				return 'etched';
			}
			// Otherwise, check the condition column for foil
			if (row && row.Condition) {
				const parsed = parseTCGPlayerSellerCondition(row.Condition);
				return parsed.foil;
			}
			return '';
		}
	}
};

export const tcgPlayerUserModule: FormatModule = {
	format: tcgPlayerUser,
	parseRow: parseUserRow,
	detectFormat: (headers: string[]): number => {
		const headerSet = new Set(headers.map((h) => h.toLowerCase()));

		// Strong indicators for TCGPlayer User format
		const strongIndicators = [
			'product id', // Unique to TCGPlayer User
			'sku', // Unique to TCGPlayer User
			'simple name' // Unique to TCGPlayer User
		];

		// Common TCGPlayer User indicators
		const commonIndicators = [
			'quantity',
			'name',
			'set',
			'set code',
			'card number',
			'printing',
			'condition',
			'language',
			'rarity'
		];

		let score = 0;
		let strongMatches = 0;

		// Check strong indicators
		for (const indicator of strongIndicators) {
			if (headerSet.has(indicator)) {
				strongMatches++;
				score += 0.4; // Each strong match is worth 40%
			}
		}

		// Check common indicators
		for (const indicator of commonIndicators) {
			if (headerSet.has(indicator)) {
				score += 0.05; // Each common match is worth 5%
			}
		}

		// Special bonus for TCGPlayer User specific combination
		if (headerSet.has('simple name') && headerSet.has('product id')) {
			score += 0.2; // Strong combination
		}

		// If we have strong indicators, boost confidence
		if (strongMatches > 0) {
			score += 0.1;
		}

		return Math.min(score, 1.0);
	}
};

export const tcgPlayerSellerModule: FormatModule = {
	format: tcgPlayerSeller,
	parseRow: parseSellerRow,
	detectFormat: (headers: string[]): number => {
		const headerSet = new Set(headers.map((h) => h.toLowerCase()));

		// Strong indicators for TCGPlayer Seller format
		const strongIndicators = [
			'tcgplayer id', // Unique to TCGPlayer Seller
			'product line', // Unique to TCGPlayer Seller
			'tcg market price', // Unique to TCGPlayer Seller
			'tcg direct low', // Unique to TCGPlayer Seller
			'tcg low price with shipping', // Unique to TCGPlayer Seller
			'add to quantity' // Unique to TCGPlayer Seller
		];

		// Common TCGPlayer Seller indicators
		const commonIndicators = [
			'total quantity',
			'product name',
			'set name',
			'condition',
			'rarity',
			'number',
			'title'
		];

		let score = 0;
		let strongMatches = 0;

		// Check strong indicators
		for (const indicator of strongIndicators) {
			if (headerSet.has(indicator)) {
				strongMatches++;
				score += 0.3; // Each strong match is worth 30%
			}
		}

		// Check common indicators
		for (const indicator of commonIndicators) {
			if (headerSet.has(indicator)) {
				score += 0.05; // Each common match is worth 5%
			}
		}

		// Special bonus for TCGPlayer Seller specific combination
		if (headerSet.has('tcgplayer id') && headerSet.has('product line')) {
			score += 0.2; // Strong combination
		}

		// If we have multiple strong indicators, boost confidence
		if (strongMatches >= 2) {
			score += 0.1;
		}

		return Math.min(score, 1.0);
	}
};

// Custom parsing function for TCGPlayer User format
function parseUserRow(row: Record<string, string>, format: CsvFormat): Record<string, string> {
	// Apply standard column mappings first
	const parsedRow: Record<string, string> = {};

	for (const [cardField, columnName] of Object.entries(format.columnMappings)) {
		if (columnName && row[columnName] !== undefined) {
			let value = row[columnName];

			// Apply transformations if they exist
			if (format.transformations && format.transformations[cardField]) {
				value = format.transformations[cardField](value);
			}

			parsedRow[cardField] = value;
		}
	}

	// Handle token and art card detection using Simple Name
	const simpleName = row['Simple Name'] || '';
	const fullName = row['Name'] || ''; // Full name for etched foil detection
	const setCode = row['Set Code'] || '';
	const setName = row['Set'] || '';

	// Detect special promo types
	const promoInfo = detectTCGPlayerPromoType(setCode, setName);

	// Check for double-faced tokens first (use full name for detection)
	const doubleFacedTokenInfo = parseDoubleFacedToken(fullName, setCode);

	if (doubleFacedTokenInfo.isDoubleFacedToken) {
		// For double-faced tokens, we need to create multiple entries
		// This will be handled in the converter engine
		parsedRow.isDoubleFacedToken = 'true';
		parsedRow.doubleFacedTokenFaces = JSON.stringify(doubleFacedTokenInfo.faces);
		if (doubleFacedTokenInfo.adjustedSetCode) {
			parsedRow.edition = doubleFacedTokenInfo.adjustedSetCode;
		}

		// For now, use the first face name as the primary name
		parsedRow.name = doubleFacedTokenInfo.faces?.[0]?.name || cleanTCGPlayerCardName(fullName);
	} else {
		// Handle regular tokens and art cards
		// Check for etched foil in full name (takes precedence over Printing column)
		const hasEtchedInName = fullName.includes('(Foil Etched)');

		const cardTypeInfo = parseTCGPlayerCardType(simpleName, setCode);

		// Use cleaned name and adjusted set code
		parsedRow.name = cardTypeInfo.cleanedName;
		if (cardTypeInfo.adjustedSetCode && cardTypeInfo.adjustedSetCode !== setCode) {
			parsedRow.edition = cardTypeInfo.adjustedSetCode;
		}

		// Handle etched foil detection - name takes precedence over Printing column
		if (hasEtchedInName) {
			parsedRow.foil = 'etched';
		}
		// Otherwise keep the original foil value from Printing column transformation
	}

	// Add promo search query if this is a special promo type
	if (promoInfo.searchQuery) {
		parsedRow.specialSearchQuery = promoInfo.searchQuery;
		parsedRow.isSpecialPromo = 'true';

		// Clear invalid set codes for promos
		if (promoInfo.isJudgePromo || promoInfo.isPrereleasePromo) {
			parsedRow.edition = ''; // Clear invalid set code, will use search instead
		}
	}

	// Add warnings if needed
	const warnings: string[] = [];

	// Add double-faced token warnings
	if (doubleFacedTokenInfo.isDoubleFacedToken) {
		if (doubleFacedTokenInfo.warnings) {
			warnings.push(...doubleFacedTokenInfo.warnings);
		}
	} else {
		// Add regular card type warnings
		const cardTypeInfo = parseTCGPlayerCardType(simpleName, setCode);
		if (cardTypeInfo.warnings) {
			warnings.push(...cardTypeInfo.warnings);
		}

		// Add etched foil warnings
		const hasEtchedInName = fullName.includes('(Foil Etched)');
		if (hasEtchedInName) {
			warnings.push('Detected etched foil from card name, overriding Printing column');
		}
	}

	// Add promo warnings
	if (promoInfo.isJudgePromo) {
		warnings.push('Judge promo detected, will use special search');
	}
	if (promoInfo.isPrereleasePromo) {
		warnings.push('Prerelease promo detected, will use special search');
	}
	if (promoInfo.isPromoPackCard) {
		warnings.push('Promo pack card detected, will use special search');
	}

	if (warnings.length > 0) {
		parsedRow.warnings = warnings.join('; ');
	}

	return parsedRow;
}

// Custom parsing function for TCGPlayer Seller format
function parseSellerRow(row: Record<string, string>, format: CsvFormat): Record<string, string> {
	// Apply standard column mappings first
	const parsedRow: Record<string, string> = {};

	for (const [cardField, columnName] of Object.entries(format.columnMappings)) {
		if (columnName && row[columnName] !== undefined) {
			let value = row[columnName];

			// Apply transformations if they exist
			if (format.transformations && format.transformations[cardField]) {
				// For foil transformation, pass the whole row
				if (cardField === 'foil' && typeof format.transformations[cardField] === 'function') {
					value = (
						format.transformations[cardField] as (
							value: string,
							row?: Record<string, string>
						) => string
					)(value, row);
				} else {
					value = format.transformations[cardField](value);
				}
			}

			parsedRow[cardField] = value;
		}
	}

	// Handle special cases for TCGPlayer Seller format
	const productName = row['Product Name'] || '';
	const setName = row['Set Name'] || '';
	const warnings: string[] = [];

	// First, detect if this is a token BEFORE processing double-faced tokens
	// This ensures we can detect " Token" text before it gets split
	const isToken = productName.toLowerCase().includes(' token');
	let tokenSetCode = parsedRow.edition;
	if (isToken && tokenSetCode && !tokenSetCode.startsWith('t')) {
		tokenSetCode = `t${tokenSetCode.toLowerCase()}`;
	}

	// Check for double-faced tokens
	const doubleFacedTokenInfo = parseDoubleFacedToken(productName, tokenSetCode);

	if (doubleFacedTokenInfo.isDoubleFacedToken) {
		// For double-faced tokens, we need to create multiple entries
		parsedRow.isDoubleFacedToken = 'true';
		parsedRow.doubleFacedTokenFaces = JSON.stringify(doubleFacedTokenInfo.faces);
		parsedRow.isToken = 'true'; // Mark as token since it's a double-faced token

		// Use the adjusted set code (with 't' prefix)
		if (doubleFacedTokenInfo.adjustedSetCode) {
			parsedRow.edition = doubleFacedTokenInfo.adjustedSetCode;
		}

		// For now, use the first face name as the primary name
		parsedRow.name = doubleFacedTokenInfo.faces?.[0]?.name || cleanTCGPlayerCardName(productName);
	} else {
		// Parse regular card type information (tokens, art cards) from product name
		const cardTypeInfo = parseTCGPlayerCardType(productName);

		// Use cleaned name
		parsedRow.name = cardTypeInfo.cleanedName;

		// Store card type info for later use in fuzzy matching
		if (cardTypeInfo.isToken || isToken) {
			parsedRow.isToken = 'true';
			// Apply token set code if detected
			if (tokenSetCode !== parsedRow.edition) {
				parsedRow.edition = tokenSetCode;
			}
		}
		if (cardTypeInfo.isArtCard) {
			parsedRow.isArtCard = 'true';
		}

		// Add card type warnings
		if (cardTypeInfo.warnings) {
			warnings.push(...cardTypeInfo.warnings);
		}

		// Check for etched foil in product name (takes precedence)
		const etchedFromName = productName.includes('(Foil Etched)');
		if (etchedFromName) {
			parsedRow.foil = 'etched';
			warnings.push('Detected etched foil from product name');
		}
	}

	// Detect special promo types from set information
	const promoInfo = detectTCGPlayerPromoType(parsedRow.edition, setName);

	// Store promo information for special search handling
	if (promoInfo.isJudgePromo) {
		parsedRow.isJudgePromo = 'true';
		if (promoInfo.searchQuery) {
			parsedRow.specialSearchQuery = promoInfo.searchQuery;
		}
		warnings.push('Judge promo detected, will use special search');
	}
	if (promoInfo.isPrereleasePromo) {
		parsedRow.isPrereleasePromo = 'true';
		if (promoInfo.searchQuery) {
			parsedRow.specialSearchQuery = promoInfo.searchQuery;
		}
		warnings.push('Prerelease promo detected, will use special search');
	}
	if (promoInfo.isPromoPackCard) {
		parsedRow.isPromoPackCard = 'true';
		if (promoInfo.searchQuery) {
			parsedRow.specialSearchQuery = promoInfo.searchQuery;
		}
		warnings.push('Promo pack card detected, will use special search');
	}

	// Add double-faced token warnings
	if (doubleFacedTokenInfo.isDoubleFacedToken && doubleFacedTokenInfo.warnings) {
		warnings.push(...doubleFacedTokenInfo.warnings);
	}

	// Add all warnings
	if (warnings.length > 0) {
		parsedRow.warnings = warnings.join('; ');
	}

	return parsedRow;
}

// Export both modules
export { tcgPlayerUser as tcgPlayer }; // Keep backward compatibility
