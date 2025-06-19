import { test, expect } from '@playwright/test';
import path from 'path';

// Test the complete CSV conversion workflow
test.describe('CSV Conversion Workflow', () => {
	test('should process Archidekt CSV file end-to-end', async ({ page }) => {
		await page.goto('/');

		// Verify the page loaded correctly
		await expect(page.locator('h1')).toContainText('OmenPath');

		// Upload a test CSV file
		const fileInput = page.locator('input[type="file"]');
		const testFilePath = path.join(__dirname, '../fixtures/archidekt-sample.csv');
		await fileInput.setInputFiles(testFilePath);

		// Wait for file to be processed and preview to show
		await expect(page.locator('[data-testid="data-preview"]')).toBeVisible();

		// Verify format was auto-detected
		await expect(page.locator('.format-detected')).toContainText('Archidekt');

		// Start conversion
		await page.click('[data-testid="convert-button"]');

		// Wait for conversion to complete
		await page.waitForSelector('[data-testid="conversion-results"]', { timeout: 30000 });

		// Verify results are displayed
		await expect(page.locator('.conversion-stats')).toBeVisible();
		await expect(page.locator('.successful-count')).toContainText(/\d+ successful/);

		// Test CSV download
		const downloadPromise = page.waitForEvent('download');
		await page.click('[data-testid="download-csv"]');
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toBe('cards.csv');

		// Verify download content (save to temp file and check)
		const downloadPath = path.join(__dirname, '../temp', download.suggestedFilename());
		await download.saveAs(downloadPath);

		// Could add more detailed content verification here
		const fs = require('fs');
		const downloadedContent = fs.readFileSync(downloadPath, 'utf8');
		expect(downloadedContent).toContain('Count,Name,Edition,Collector Number');
	});

	test('should handle failed cards and display error details', async ({ page }) => {
		await page.goto('/');

		// Upload a CSV with problematic entries
		const fileInput = page.locator('input[type="file"]');
		const testFilePath = path.join(__dirname, '../fixtures/malformed-sample.csv');
		await fileInput.setInputFiles(testFilePath);

		// Process the file
		await page.click('[data-testid="convert-button"]');
		await page.waitForSelector('[data-testid="conversion-results"]');

		// Verify failed cards section is visible
		await expect(page.locator('.failed-cards-section')).toBeVisible();
		await expect(page.locator('.failed-cards-section h3')).toContainText('Failed Cards Details');

		// Check that row numbers are displayed
		await expect(page.locator('.row-number')).toContainText('Row');

		// Verify error messages are shown
		await expect(page.locator('.error-badge')).toBeVisible();
		await expect(page.locator('.issue-text')).toContainText(/error|not found|invalid/i);

		// Test show/hide additional columns
		await page.click('[data-testid="show-additional-columns"]');
		await expect(page.locator('th:has-text("Collector Number")')).toBeVisible();
		await expect(page.locator('th:has-text("Language")')).toBeVisible();
	});

	test('should work correctly in dark mode', async ({ page }) => {
		await page.goto('/');

		// Toggle dark mode
		await page.click('[data-testid="theme-toggle"]');
		await expect(page.locator('html')).toHaveClass(/dark/);

		// Upload and process a file
		const fileInput = page.locator('input[type="file"]');
		const testFilePath = path.join(__dirname, '../fixtures/moxfield-sample.csv');
		await fileInput.setInputFiles(testFilePath);

		await page.click('[data-testid="convert-button"]');
		await page.waitForSelector('[data-testid="conversion-results"]');

		// Verify dark mode styling is applied
		const resultsSection = page.locator('[data-testid="conversion-results"]');
		await expect(resultsSection).toHaveCSS('background-color', /rgb\(31, 41, 55\)|#1f2937/); // dark:bg-gray-800

		// If there are failed cards, check their dark mode styling too
		const failedCardsSection = page.locator('.failed-cards-section');
		if (await failedCardsSection.isVisible()) {
			await expect(failedCardsSection).toHaveCSS(
				'background-color',
				/rgb\(127, 29, 29\)|rgba\(127, 29, 29/
			); // dark red background
		}
	});

	test('should handle large files without timing out', async ({ page }) => {
		// Increase timeout for this test
		test.setTimeout(60000);

		await page.goto('/');

		// Upload a large CSV file
		const fileInput = page.locator('input[type="file"]');
		const testFilePath = path.join(__dirname, '../fixtures/large-collection.csv');
		await fileInput.setInputFiles(testFilePath);

		// Start conversion
		await page.click('[data-testid="convert-button"]');

		// Verify progress indicator is shown
		await expect(page.locator('[data-testid="conversion-progress"]')).toBeVisible();

		// Wait for completion with extended timeout
		await page.waitForSelector('[data-testid="conversion-results"]', { timeout: 50000 });

		// Verify results are displayed
		await expect(page.locator('.conversion-stats')).toBeVisible();

		// Check that the page is still responsive
		await expect(page.locator('[data-testid="download-csv"]')).toBeEnabled();
	});

	test('should validate format selection and preview', async ({ page }) => {
		await page.goto('/');

		// Upload a CSV file
		const fileInput = page.locator('input[type="file"]');
		const testFilePath = path.join(__dirname, '../fixtures/generic-sample.csv');
		await fileInput.setInputFiles(testFilePath);

		// Wait for preview
		await expect(page.locator('[data-testid="data-preview"]')).toBeVisible();

		// Manually select a different format
		await page.selectOption('[data-testid="format-selector"]', 'moxfield');

		// Verify preview updates
		await expect(page.locator('.format-selected')).toContainText('Moxfield');

		// Check preview table headers match format
		await expect(page.locator('.preview-table th')).toContainText('Count');
		await expect(page.locator('.preview-table th')).toContainText('Name');
		await expect(page.locator('.preview-table th')).toContainText('Edition');

		// Switch to different format
		await page.selectOption('[data-testid="format-selector"]', 'archidekt');
		await expect(page.locator('.format-selected')).toContainText('Archidekt');
	});

	test('should handle network errors gracefully', async ({ page }) => {
		// Mock network failure by blocking Scryfall API requests
		await page.route('https://api.scryfall.com/**/*', (route) => route.abort());

		await page.goto('/');

		// Upload a file and try to process
		const fileInput = page.locator('input[type="file"]');
		const testFilePath = path.join(__dirname, '../fixtures/simple-sample.csv');
		await fileInput.setInputFiles(testFilePath);

		await page.click('[data-testid="convert-button"]');

		// Should show error message
		await expect(page.locator('.error-message')).toBeVisible();
		await expect(page.locator('.error-message')).toContainText(/network|connection|api/i);

		// Should still allow user to try again
		await expect(page.locator('[data-testid="convert-button"]')).toBeEnabled();
	});
});
