# Testing Setup for OmenPath

## Overview

This document outlines the testing strategy for the OmenPath CSV converter using Vitest (unit/integration) and Playwright (E2E).

## Vitest Setup

### Installation

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/svelte
```

### Configuration (vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		setupFiles: ['./src/tests/setup.ts']
	}
});
```

### Test Structure

```
src/
├── lib/
│   ├── core/
│   │   ├── converter/
│   │   │   ├── converter-engine.test.ts
│   │   │   ├── api/
│   │   │   │   └── scryfall-api.test.ts
│   │   │   ├── strategies/
│   │   │   │   ├── primary-lookup.test.ts
│   │   │   │   └── secondary-lookup.test.ts
│   │   │   └── validation/
│   │   │       └── card-validator.test.ts
│   │   └── detection/
│   │       └── format-detector.test.ts
│   ├── utils/
│   │   ├── conversion/
│   │   │   ├── stats-calculator.test.ts
│   │   │   └── export-utils.test.ts
│   │   └── scryfall-utils.test.ts
│   └── components/
│       └── conversion/
│           └── ConversionResults/
│               └── FailedCardsDisplay.test.ts
└── tests/
    ├── setup.ts
    ├── mocks/
    │   ├── scryfall-responses.ts
    │   └── csv-samples.ts
    └── fixtures/
        ├── archidekt-sample.csv
        ├── moxfield-sample.csv
        └── malformed-sample.csv
```

## Playwright Setup

### Installation

```bash
npm install -D @playwright/test
npx playwright install
```

### Configuration (playwright.config.ts)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'on-first-retry'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] }
		},
		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'] }
		}
	],
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173
	}
});
```

### E2E Test Structure

```
e2e/
├── fixtures/
│   ├── csv-samples/
│   │   ├── archidekt-valid.csv
│   │   ├── moxfield-valid.csv
│   │   └── malformed.csv
├── tests/
│   ├── file-upload.spec.ts
│   ├── conversion-workflow.spec.ts
│   ├── export-functionality.spec.ts
│   ├── error-handling.spec.ts
│   └── ui-interactions.spec.ts
└── helpers/
    └── test-utils.ts
```

## Key Test Scenarios

### Unit Tests (Vitest)

1. **Format Detection**
   - Auto-detect various CSV formats
   - Handle edge cases (empty files, single column)
2. **CSV Parsing**
   - Parse different format structures
   - Handle special characters and encoding
3. **Card Validation**
   - Validate against Scryfall data
   - Handle confidence levels
4. **API Integration**
   - Mock Scryfall API responses
   - Test rate limiting and error handling
5. **Export Functions**
   - Generate correct CSV/TXT formats
   - Handle special characters in output

### E2E Tests (Playwright)

1. **Complete Workflow**
   - Upload → Process → Export
   - Multiple file formats
2. **UI Interactions**
   - Format selection
   - Preview functionality
   - Toggle additional columns
3. **Error Scenarios**
   - Invalid file uploads
   - Network failures
   - Malformed CSV handling
4. **Accessibility**
   - Keyboard navigation
   - Screen reader compatibility
5. **Performance**
   - Large file processing
   - Memory usage validation

## Benefits

### Vitest Benefits

- **Fast Development**: Instant feedback on code changes
- **Regression Prevention**: Catch breaking changes immediately
- **API Mocking**: Test without hitting external APIs
- **Coverage Reports**: Identify untested code paths
- **Refactoring Confidence**: Safe to refactor with comprehensive tests

### Playwright Benefits

- **Real User Scenarios**: Test actual user workflows
- **Cross-Browser Testing**: Ensure compatibility
- **Visual Regression**: Catch UI breaking changes
- **Performance Monitoring**: Detect slow operations
- **Integration Validation**: Verify all components work together

## Implementation Priority

### Phase 1: Core Unit Tests

1. Format detection tests
2. CSV parsing tests
3. Basic API mocking

### Phase 2: Integration Tests

1. End-to-end conversion workflow
2. Export functionality
3. Error handling

### Phase 3: Comprehensive E2E

1. Full user workflows
2. Cross-browser testing
3. Performance benchmarks

### Phase 4: Advanced Testing

1. Visual regression testing
2. Accessibility testing
3. Load testing with large files
