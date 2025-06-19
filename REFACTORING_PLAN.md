# Refactoring Plan: Split Large Files

## Overview

Split `converter-engine.ts` (1632 lines) and `ConversionResults.svelte` (865 lines) into smaller, focused modules while preserving all functionality.

## 1. Refactor `converter-engine.ts`

### Current Structure (1632 lines)

- Language mapping and validation
- Scryfall API communication
- Card parsing and validation
- Multiple conversion strategies
- Result formatting

### New Structure (7 smaller files):

#### `src/lib/core/converter/api/`

- **`scryfall-api.ts`** - Scryfall API communication, rate limiting, batch processing
- **`language-validator.ts`** - Language mapping, validation, and Scryfall language code conversion

#### `src/lib/core/converter/validation/`

- **`card-validator.ts`** - Card data validation, Scryfall match validation
- **`set-validator.ts`** - Set code validation and correction (extract from current engine)

#### `src/lib/core/converter/strategies/`

- **`name-collector-lookup.ts`** - Name + collector number search strategy
- **`primary-lookup.ts`** - Primary Collection endpoint strategy
- **`secondary-lookup.ts`** - Language-specific secondary lookups

#### `src/lib/core/converter/`

- **`converter-engine.ts`** (reduced) - Main orchestration, interface implementation
- **`result-formatter.ts`** - CSV/TXT export formatting functions

## 2. Refactor `ConversionResults.svelte`

### Current Structure (865 lines)

- Statistics calculation
- Export functionality
- Table display
- Error/warning visualization
- Success messaging

### New Structure (5 smaller components):

#### `src/lib/components/conversion/ConversionResults/`

- **`ConversionResults.svelte`** (reduced) - Main container, orchestration
- **`ConversionStats.svelte`** - Statistics display (confidence, methods, counts)
- **`ResultsTable.svelte`** - Preview table with sorting and filtering
- **`FailedCardsDisplay.svelte`** - Failed cards analysis and display
- **`ExportButtons.svelte`** - CSV/TXT download functionality

#### `src/lib/utils/conversion/`

- **`export-utils.ts`** - CSV/TXT generation logic (move from Svelte component)
- **`stats-calculator.ts`** - Statistics calculation utilities

## Benefits of This Refactoring

### For `converter-engine.ts`:

1. **Single Responsibility**: Each module handles one aspect (API, validation, strategy)
2. **Testability**: Smaller modules are easier to unit test
3. **Maintainability**: Changes to language handling don't affect API communication
4. **Reusability**: Validation modules can be used independently
5. **Performance**: Better tree-shaking potential

### For `ConversionResults.svelte`:

1. **Component Reusability**: Stats component can be used elsewhere
2. **Performance**: Smaller components re-render less frequently
3. **Maintainability**: Table logic separated from export logic
4. **Readability**: Each component has a clear purpose
5. **Testing**: Individual components easier to test

## Implementation Order

1. Create new API and utility modules first
2. Create validation modules
3. Create strategy modules
4. Refactor main converter engine to use new modules
5. Create new Svelte components
6. Refactor main ConversionResults to use new components
7. Update all imports throughout the codebase
8. Test functionality to ensure no regressions

This approach maintains all existing functionality while making the codebase more maintainable and following best practices for separation of concerns.
