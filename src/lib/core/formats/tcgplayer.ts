import type { CsvFormat } from '../../types.js';
import type { FormatModule } from './base.js';
import {
	cleanTCGPlayerCardName,
	parseTCGPlayerSellerCondition
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
		foil: (value: string) => (value.toLowerCase() === 'foil' ? 'foil' : ''),
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

// Export both modules
export { tcgPlayerUser as tcgPlayer }; // Keep backward compatibility
