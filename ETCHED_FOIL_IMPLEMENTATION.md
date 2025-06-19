# Etched Foil Handling Implementation Summary

## Overview

Implemented comprehensive etched foil handling across all supported formats in OmenPath, with format-specific parsing logic and proper data cleaning.

## Key Changes Made

### 1. Core Infrastructure

- **Added `isEtched: boolean` property to `ParsedCard` type** - Now tracks etched status separately from regular foil status
- **Updated `converter-engine.ts`** - Added etched foil parsing to the main card parsing pipeline
- **Enhanced `result-formatter.ts`** - Updated Moxfield output formatting to handle etched foils properly

### 2. Centralized Parsing Logic

Created `parseEtchedFoil()` helper function in `format-helpers.ts` that:

- Takes format ID, row data, set code, and set name as parameters
- Returns structured result with `isEtched` status, cleaned set information, and warnings
- Handles format-specific detection patterns and data cleaning requirements

### 3. Format-Specific Implementations

#### **Archidekt**

- **Detection**: `Finish` column contains "Etched"
- **Status**: ✅ Implemented

#### **CardCastle**

- **Detection**: No special etched foil handling (doesn't support etched/foil distinction for same card)
- **Status**: ✅ Documented limitation

#### **Cardsphere**

- **Detection**: Set name (`Edition` column) contains "Etched Foil"
- **Cleaning**: Removes frame descriptors and "Etched Foil" suffix from set names
- **Example**: "Modern Horizons 2 Retro Frame Etched Foil" → "Modern Horizons 2"
- **Status**: ✅ Implemented

#### **CubeCobra**

- **Detection**: `Finish` column contains "Etched"
- **Status**: ✅ Implemented

#### **DeckBox**

- **Detection**:
  - Set code ends with `_E` suffix
  - Set name ends with " Etched" suffix
- **Cleaning**:
  - Removes `_E` from set codes
  - Removes " Etched" from set names
  - Adds validation warnings for set code changes
- **Status**: ✅ Implemented

#### **DeckStats**

- **Detection**: Cannot distinguish between foil and etched for cards that support both
- **Handling**: Flags ambiguous cases for user review
- **Status**: ✅ Documented limitation with warning system

#### **DragonShield**

- **Detection**: `Printing` column contains "Etched"
- **Status**: ✅ Implemented

#### **Helvault**

- **Detection**: `extras` column contains "etchedFoil"
- **Status**: ✅ Implemented

#### **ManaBox & Moxfield**

- **Detection**: `Foil` column contains "etched"
- **Status**: ✅ Implemented

#### **MTGO**

- **Detection**: No etched foil support in available export formats
- **Status**: ✅ Documented limitation

#### **TappedOut**

- **Detection**: `Foil` column contains "f-etch"
- **Status**: ✅ Implemented

#### **TCGPlayer (Updated to handle two formats)**

- **TCGPlayer User Format**:
  - **Detection**: Card name contains "(Foil Etched)"
  - **Cleaning**: Removes parenthetical suffixes from card names
- **TCGPlayer Seller Format**:
  - **Detection**: Card name contains "(Foil Etched)" AND condition contains "Foil"
  - **Cleaning**: Extracts foil status from condition, cleans card names
- **Status**: ✅ Implemented both user and seller formats

#### **Urza's Gatherer**

- **Detection**: `Special foil count` > 0 indicates etched foils
- **Additional**: Also tracks regular `Foil count` separately
- **Status**: ✅ Implemented with column mapping updates

## Technical Details

### Parsing Pipeline

1. **Card Row Parsing**: Each card row is processed through the main parsing pipeline
2. **Etched Detection**: `parseEtchedFoil()` is called for every card with format-specific logic
3. **Data Cleaning**: Set codes and names are cleaned based on format requirements
4. **Warning Generation**: Warnings are added for ambiguous cases or data transformations
5. **Result Formatting**: Etched status is properly formatted in Moxfield output

### Output Format

- **Moxfield Foil Column**:
  - `"etched"` for etched foils
  - `"foil"` for regular foils
  - `""` (empty) for non-foil cards
- **Priority**: Etched status takes precedence over regular foil status when both are detected

### Error Handling

- **Set Validation**: Cleaned set codes are validated against Scryfall database
- **Warning System**: Users are notified of data transformations and ambiguous cases
- **Graceful Degradation**: Parsing continues even if etched detection fails

## Testing Status

- **Linting**: ✅ All ESLint and Prettier checks pass
- **Build**: ✅ Development server starts successfully
- **Format Registration**: ✅ All formats registered in auto-detector
- **Type Safety**: ✅ All TypeScript compilation passes

## Future Enhancements

- Add comprehensive unit tests for etched foil parsing
- Implement foil validation against Scryfall card finishes data
- Add user preferences for handling ambiguous foil cases
- Consider adding support for other special finishes (showcase, extended art, etc.)

## Files Modified

- `src/lib/core/converter/converter-engine.ts` - Added etched parsing to main pipeline
- `src/lib/core/converter/result-formatter.ts` - Updated Moxfield output formatting
- `src/lib/utils/format-helpers.ts` - Added `parseEtchedFoil()` and TCGPlayer helpers
- `src/lib/core/formats/tcgplayer.ts` - Split into user/seller formats with etched support
- `src/lib/core/formats/urzasgatherer.ts` - Added special foil count column mapping
- `src/lib/core/detection/auto-detector.ts` - Registered new TCGPlayer format variants
- `src/lib/types.ts` - Added `isEtched` property to ParsedCard type (previously done)
