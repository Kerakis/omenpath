# Project Structure Documentation

## Overview

This document explains the organization and purpose of the OmenPath project structure.

## Directory Structure

### `/src/lib/core/`

Core business logic organized by functionality:

#### `/converter/`

Main conversion engine and related components:

- `converter-engine.ts` - Legacy conversion engine
- `converter-engine-new.ts` - New refactored conversion engine
- `formatter.ts` - Output formatting utilities
- `result-formatter.ts` - Result display formatting
- `index.ts` - Public API exports

##### `/api/`

External API interaction utilities:

- `language-validator.ts` - Language code validation and conversion for Scryfall API
- `scryfall-api.ts` - Scryfall API client and utilities

##### `/strategies/`

Lookup strategy implementations:

- `primary-lookup.ts` - Primary card lookup strategy
- `secondary-lookup.ts` - Secondary/fallback lookup strategy
- `name-collector-lookup.ts` - Name and collector number lookup strategy

##### `/validation/`

Data validation logic:

- `card-validator.ts` - Card data validation and matching logic

#### `/detection/`

Format detection system:

- `auto-detector.ts` - Main format detection engine
- `auto-detector.test.ts` - Tests for format detection
- `index.ts` - Public API exports

#### `/formats/`

Format-specific parsers and converters:

- `archidekt.ts` - Archidekt format handler
- `deckbox.ts` - Deckbox format handler
- `moxfield.ts` - Moxfield format handler
- `helvault.ts` - Helvault format handler
- `manabox.ts` - ManaBox format handler
- ... (other format handlers)

### `/src/lib/utils/`

Shared utility functions:

- `format-helpers.ts` - Common formatting utilities

### `/src/lib/components/`

Svelte UI components:

- `CsvConverter.svelte` - Main converter component
- `FileUpload.svelte` - File upload component
- `ConversionResults.svelte` - Results display component
- `ConversionProgress.svelte` - Progress indicator
- ... (other UI components)

### `/static/`

Static assets served directly:

- `CSV Examples/` - Sample CSV files for testing and reference
- `data/sets.json` - MTG set data
- `favicon.png` - Site icon

### `/src/tests/`

Test files and fixtures:

- `*.test.ts` - Unit tests
- `fixtures/` - Test data files

## File Organization Principles

### 1. Separation of Concerns

- **API Layer** (`/api/`): External service interactions
- **Validation Layer** (`/validation/`): Data validation and verification
- **Strategy Layer** (`/strategies/`): Different approaches to data lookup
- **Format Layer** (`/formats/`): Format-specific parsing and conversion

### 2. Logical Grouping

Files are grouped by their primary responsibility rather than by file type.

### 3. Clear Dependencies

- Core logic doesn't depend on UI components
- Format handlers are independent of each other
- Utilities are shared across modules

## Key Design Decisions

### Language Validator Placement

`language-validator.ts` is placed in `/api/` rather than `/validation/` because:

- It primarily handles language code conversion for API interactions
- It contains Scryfall-specific language mappings
- It's used by API lookup strategies rather than general validation

### Format Detection vs Format Handling

- Format detection logic is centralized in `/detection/`
- Format-specific parsing is handled in individual `/formats/` modules
- This separation allows for easy addition of new formats

### Test Organization

Tests are co-located with their corresponding modules for easier maintenance.

## Future Improvements

1. Consider adding a `/types/` directory for shared TypeScript interfaces
2. Evaluate if `/utils/` should be split into more specific categories
3. Monitor if any format handlers become large enough to warrant their own subdirectories
