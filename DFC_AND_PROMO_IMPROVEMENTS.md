# Dual-Faced Cards and Promo Improvements

## Overview

This document summarizes the improvements made to handle dual-faced cards (DFCs), special promo cards (Judge, Prerelease, Promo Pack), and refined etched foil logic for TCGPlayer format.

## Changes Implemented

### 1. Dual-Faced Card (DFC) Name Validation

**File**: `src/lib/core/converter/validation/card-validator.ts`

- **Issue**: Cards were failing validation when the CSV contained only the front face name of a dual-faced card (e.g., "Selfless Glyphweaver") but Scryfall returned the full DFC name (e.g., "Selfless Glyphweaver // Deadly Vanity").

- **Solution**: Enhanced the name validation logic to check if either face of a DFC matches the original name:
  ```typescript
  // Check for dual-faced card flexibility
  if (scryfallCard.name.includes(' // ')) {
  	const faces = scryfallCard.name.split(' // ').map((face) => face.trim().toLowerCase());
  	const originalNameLower = originalCard.name.toLowerCase().trim();
  	nameMatches = faces.some((face) => face === originalNameLower);
  }
  ```

### 2. Special Promo Card Handling

**Files**:

- `src/lib/utils/format-helpers.ts` (detection)
- `src/lib/utils/scryfall-utils.ts` (search API)
- `src/lib/core/converter/strategies/primary-lookup.ts` (integration)

#### Judge Promos

- **Issue**: TCGPlayer uses invalid set code `jdg` and set name "Judge Promos"
- **Solution**: Detect these cards and use Scryfall search endpoint with query `"{cardName}" is:judge ++`

#### Prerelease Promos

- **Issue**: TCGPlayer uses invalid set code `PRE`
- **Solution**: Detect these cards and use Scryfall search endpoint with query `"{cardName}" is:prerelease ++`

#### Promo Pack Cards

- **Issue**: TCGPlayer uses erroneous set codes but includes "Promo Pack:" in set name
- **Solution**: Detect these cards and use Scryfall search endpoint with query `"{cardName}" is:promopack ++`

#### Search Logic

- If exactly 1 card found: Use it with high confidence
- If 0 cards found: Mark as failed with appropriate error message
- If >1 cards found: Use first result with medium confidence and warning to verify

### 3. Refined Etched Foil Logic for TCGPlayer

**File**: `src/lib/core/formats/tcgplayer.ts`

- **Issue**: Cards with `(Foil Etched)` in the name were incorrectly marked as regular foil due to the "Foil" value in the Finish/Condition column.

- **Solution**: Updated both User and Seller format transformations to prioritize etched foil detection from card name:

  ```typescript
  // For User format
  foil: (value: string, row?: Record<string, string>) => {
  	const cardName = row?.Name || '';
  	if (cardName.includes('(Foil Etched)')) {
  		return 'etched';
  	}
  	return value.toLowerCase() === 'foil' ? 'foil' : '';
  };

  // For Seller format
  foil: (value: string, row?: Record<string, string>) => {
  	const productName = row?.['Product Name'] || '';
  	if (productName.includes('(Foil Etched)')) {
  		return 'etched';
  	}
  	// Check condition column for foil
  	if (row && row.Condition) {
  		const parsed = parseTCGPlayerSellerCondition(row.Condition);
  		return parsed.foil;
  	}
  	return '';
  };
  ```

### 4. Enhanced TCGPlayer Parsing Functions

**File**: `src/lib/core/formats/tcgplayer.ts`

- Updated both `parseUserRow` and `parseSellerRow` functions to:
  - Detect and handle etched foil cards from name
  - Identify special promo types and store search queries
  - Add appropriate warnings for user feedback
  - Store promo flags for special handling in the lookup pipeline

### 5. New Scryfall Search Function

**File**: `src/lib/utils/scryfall-utils.ts`

- Added `searchScryfallCards()` function to handle special promo searches
- Includes proper error handling, confidence scoring, and warning generation
- Uses Scryfall's search endpoint with specialized queries for different promo types

### 6. Integration with Lookup Pipeline

**File**: `src/lib/core/converter/strategies/primary-lookup.ts`

- Modified `performPrimaryLookups()` to handle special promo cards before regular batch processing
- Added `handleSpecialPromoSearch()` function for individual promo card processing
- Maintains proper rate limiting for search endpoint calls
- Preserves existing batch processing for regular cards

## Testing Recommendations

1. **Dual-Faced Cards**: Test with cards that have only the front face name in CSV
2. **Judge Promos**: Test with TCGPlayer exports containing judge promo cards (set code `jdg`)
3. **Prerelease Promos**: Test with prerelease promo cards (set code `PRE`)
4. **Promo Pack Cards**: Test with cards that have "Promo Pack:" in the set name
5. **Etched Foils**: Test TCGPlayer cards with `(Foil Etched)` in the name to ensure they're marked as etched, not foil

## Error Messages and User Feedback

- Added specific warning messages for each promo type detected
- Enhanced confidence scoring based on search results
- Improved error messages for failed special searches
- Maintained backward compatibility with existing conversion logic

## Performance Considerations

- Special promo searches are processed individually (not in batches) due to different API endpoint
- Proper rate limiting applied between search calls
- Regular cards still processed in efficient batches via collection endpoint
- Added progress callback updates for special promo processing
