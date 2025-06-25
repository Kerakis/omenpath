# OmenPath Testing Documentation

This document provides an overview of the comprehensive test suite created for the OmenPath CSV converter application.

## Test Structure

The test suite is organized into three main categories:

### 1. Unit Tests (`src/__tests__/unit/`)

**Purpose**: Test individual functions and modules in isolation.

#### `stats-calculator.test.ts`

- Tests the statistics calculation functions
- Covers `getStats()`, `getConfidenceStats()`, and `getIdentificationMethods()`
- Validates correct counting of successful/failed conversions
- Tests confidence level distribution calculations
- Verifies identification method tracking

#### `scryfall-utils.test.ts`

- Tests the Scryfall API health checking functionality
- Mocks network requests to test various scenarios:
  - Successful API responses
  - Network errors
  - Non-200 status codes
- Validates error handling and response formatting

#### `converter-engine.test.ts`

- Tests the main converter engine functionality
- Mocks all dependencies for isolated testing
- Covers:
  - Format detection from headers and content
  - File parsing with progress callbacks
  - Set code validation
  - API health checking

#### `export-utils.test.ts`

- Tests CSV export utility functions
- Validates original CSV line extraction
- Tests handling of missing data
- Verifies preservation of field order

### 2. Component Tests (`src/__tests__/components/`)

**Purpose**: Test Svelte components in isolation using Testing Library.

#### `ConversionProgress.test.ts`

- Tests the progress bar component
- Validates:
  - Correct percentage display and rounding
  - Progress bar width styling
  - Status text rendering
  - Spinner animation presence

#### `FailedCardsDisplay.test.ts`

- Tests the conversion issues/failed cards display component
- Covers:
  - Conditional rendering (no issues vs. showing issues)
  - Error vs. warning card display
  - Proper sorting (errors before warnings)
  - Additional columns toggle functionality
  - Multiple warnings per card
  - Helpful footer messages

### 3. End-to-End Tests (`e2e/`)

**Purpose**: Test complete user workflows in a real browser environment.

#### `conversion-workflow.spec.ts` (existing)

- Tests the complete CSV conversion process
- File upload and processing
- Results display and download
- Error handling for problematic files
- Dark mode functionality

#### `enhanced-workflow.spec.ts` (new)

- **Format Detection**: Auto-detection vs. manual selection
- **Export Options**: Multi-currency price selection, option enabling/disabling
- **Data Preview**: Warning display, proceeding with warnings
- **Error Handling**: Empty files, malformed CSV data

## Test Configuration

### Vitest Configuration

- **Server tests**: Node environment for pure logic testing
- **Client tests**: jsdom environment for component testing with SVelte
- **Setup files**: Includes jest-dom matchers and browser mocks
- **Coverage**: Configured to track test coverage across the codebase

### Testing Library Setup

- Uses `@testing-library/svelte` for component testing
- Custom matchers from `@testing-library/jest-dom`
- Proper mocking of Svelte 5 runes and reactivity

## Running Tests

```bash
# Run all unit and component tests
npm run test:unit

# Run end-to-end tests (requires Playwright setup)
npm run test:e2e

# Run all tests
npm run test
```

## Test Coverage Areas

### ✅ Well Covered

- **Core Utilities**: Statistics, export functions, format helpers
- **API Integration**: Scryfall health checking, error handling
- **Component Rendering**: Progress display, error/warning display
- **User Workflows**: File upload, conversion, export options

### 🔄 Partially Covered

- **Format Detection**: Basic functionality tested, edge cases could use more coverage
- **File Parsing**: Core logic tested via mocks, integration tests needed
- **Complex Conversion Logic**: Primary lookup strategies need dedicated tests

### 📋 Future Test Expansion

#### Additional Unit Tests Needed

- `primary-lookup.ts` - Core card matching logic
- `result-formatter.ts` - Export formatting functions
- `fuse-search.ts` - Fuzzy matching utilities
- Format-specific parsers (Archidekt, Moxfield, etc.)

#### Additional Component Tests Needed

- `CsvConverter.svelte` - Main conversion component
- `DataPreview.svelte` - Data preview with warnings
- `ExportOptionsSelector.svelte` - Export configuration
- `ConversionResults.svelte` - Results display container

#### Additional Integration Tests Needed

- Full conversion pipeline with real CSV files
- Error recovery and retry mechanisms
- Performance testing with large files
- Cross-browser compatibility (via Playwright)

## Testing Best Practices Followed

1. **Isolation**: Each test is independent and doesn't rely on external state
2. **Mocking**: External dependencies are properly mocked
3. **Coverage**: Tests cover both happy path and error scenarios
4. **Readability**: Test names clearly describe what is being tested
5. **Maintainability**: Tests are organized logically and easy to update

## Continuous Integration

The test suite is designed to run in CI/CD environments:

- Fast unit tests provide quick feedback
- Component tests ensure UI reliability
- E2E tests validate complete user workflows
- All tests must pass before deployment

## Mock Strategy

### Network Requests

- Fetch API is mocked for Scryfall API tests
- Different response scenarios are simulated
- Error conditions are properly tested

### File Operations

- File reading is mocked with controlled test data
- Progress callbacks are simulated
- Large file scenarios can be tested safely

### Svelte Components

- Runes and reactivity are handled via testing library
- Component props and events are properly mocked
- DOM interactions are tested realistically

This comprehensive test suite ensures the reliability and maintainability of the OmenPath application while providing confidence for future development and refactoring.
