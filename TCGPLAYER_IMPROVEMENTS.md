# TCGPlayer Format Improvements and Fuzzy Matching Enhancements

## Summary of Changes Made

### 1. TCGPlayer Token and Art Card Detection

#### **New Helper Functions in `format-helpers.ts`**

- **`parseTCGPlayerCardType()`**: Detects tokens and art cards from card names
  - Detects " Token" in card names → adjusts set code with "T" prefix (e.g., `DFT` → `TDFT`)
  - Detects " Art Card" in card names → adjusts set code with "A" prefix (e.g., `DFT` → `ADFT`)
  - Returns cleaned card name, adjusted set code, detection flags, and warnings

#### **Updated TCGPlayer Format Modules**

- **Split into two distinct formats**: `tcgplayer-user` and `tcgplayer-seller`
- **Custom parsing functions**:
  - `parseUserRow()`: Handles user format with Simple Name detection
  - `parseSellerRow()`: Handles seller format with Product Name detection
- **Enhanced auto-detection**: Separate detection logic for user vs seller formats

#### **Format-Specific Handling**

- **User Format**: Uses `Simple Name` column for cleaner card names
- **Seller Format**: Uses `Product Name` column and extracts foil status from `Condition`
- **Both formats**: Detect token/art cards and flag for set code adjustment

### 2. Enhanced Converter Engine

#### **Custom Format Parsing Support**

- **Updated `parseCardRow()`**: Now supports custom `parseRow` functions from format modules
- **Format Module Integration**: Added `getFormatModule()` method to auto-detector
- **Dynamic Parsing**: Uses format-specific parsing when available, falls back to standard mapping

#### **Token/Art Card Integration**

- **Parsing Pipeline**: Token and art card detection integrated into main parsing flow
- **Warning System**: Users are notified when set codes are adjusted for tokens/art cards
- **Set Validation**: Prepared for enhanced fuzzy matching with token/art preferences

### 3. Improved Failed Card Sorting

#### **Updated `FailedCardsDisplay.svelte`**

- **Row Number Sorting**: Failed cards now sorted by original CSV row number instead of alphabetically
- **Better UX**: Users can trace failed cards back to their original CSV more easily
- **Maintained Functionality**: All existing error and warning display features preserved

### 4. Enhanced Fuzzy Matching Algorithm

#### **Completely Rewritten `fuzzyMatch()` Function**

- **Word-Based Matching**: Tokenizes strings and matches words individually
- **Exact Word Bonus**: Perfect word matches get highest scores
- **Partial Word Support**: Handles abbreviations and partial matches with penalties
- **Length Ratio Consideration**: Penalizes very different string lengths

#### **Special "Edition" Handling**

- **Edition Word Validation**: Specifically checks edition descriptors (10th, Mythic, etc.)
- **Cross-Edition Penalty**: Heavy penalty when matching different editions
- **Improved Precision**: "10th Edition" will now correctly match "Tenth Edition" over "Mythic Edition"

#### **Enhanced `findSetCodeByName()` Function**

- **Token Set Preference**: Option to prefer sets with "Tokens" in the name
- **Art Series Preference**: Option to prefer sets with "Art Series" in the name
- **Fallback Logic**: Falls back to general matching if specialized matching fails
- **Better Confidence Scoring**: More accurate confidence scores for matches

### 5. Technical Infrastructure Updates

#### **Format Module Enhancement**

- **Auto-Detector Updates**: Added `getFormatModule()` method for retrieving format modules
- **Base Interface Updates**: Enhanced `AutoDetector` interface with new method
- **Module Registration**: Registered both TCGPlayer format variants

#### **Type Safety and Validation**

- **Import Updates**: Added necessary type imports for `FormatModule`
- **Error Handling**: Improved error handling in parsing pipeline
- **Warning System**: Enhanced warning generation for data transformations

## Example Improvements

### **Before (10th Edition Fuzzy Matching)**

```
Input: "10th Edition"
Matched: "Mythic Edition" (incorrect)
Confidence: ~0.75
```

### **After (10th Edition Fuzzy Matching)**

```
Input: "10th Edition"
Matched: "Tenth Edition" (correct)
Confidence: ~0.85
Reason: Edition word validation prevents cross-edition matching
```

### **TCGPlayer Token Detection**

```
Input: "Goblin Token"
Detected: Token card
Set Code Adjustment: DFT → TDFT
Warning: "Detected token card, adjusted set code from DFT to TDFT"
```

### **Failed Card Sorting**

```
Before: Alphabetical by card name
After: Numerical by original CSV row number (2, 3, 4, ...)
```

## Files Modified

- `src/lib/utils/format-helpers.ts` - Added `parseTCGPlayerCardType()` function
- `src/lib/core/formats/tcgplayer.ts` - Complete rewrite with dual formats and custom parsing
- `src/lib/core/detection/auto-detector.ts` - Added `getFormatModule()` method and new format registration
- `src/lib/core/formats/base.ts` - Enhanced `AutoDetector` interface
- `src/lib/core/converter/converter-engine.ts` - Added custom parsing support and format module integration
- `src/lib/utils/scryfall-utils.ts` - Completely rewritten fuzzy matching algorithm with edition handling
- `src/lib/components/conversion/ConversionResults/FailedCardsDisplay.svelte` - Added row number sorting

## Testing Status

- ✅ **Linting**: All ESLint and Prettier checks pass
- ✅ **Type Safety**: All TypeScript compilation successful
- ✅ **Format Detection**: Both TCGPlayer formats properly registered and detected
- ✅ **Parsing Integration**: Custom parsing functions integrated into conversion pipeline

## Future Benefits

1. **More Accurate Token/Art Card Handling**: Proper set code detection for special card types
2. **Better Set Matching**: Reduced false positives in fuzzy matching, especially for editions
3. **Improved User Experience**: Failed cards sorted logically by row number
4. **Extensible Architecture**: Custom parsing framework ready for other complex formats
5. **Robust Error Handling**: Better warnings and error messages for edge cases

The implementation provides a solid foundation for handling the complex nuances of TCGPlayer exports while significantly improving the accuracy of set name matching across all formats.
