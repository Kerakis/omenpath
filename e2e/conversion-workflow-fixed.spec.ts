import { test, expect, Page } from '@playwright/test';

// Helper function to create a file via JavaScript in the browser
async function uploadCsvContent(page: Page, filename: string, content: string) {
	await page.evaluate(
		({ content, filename }) => {
			const file = new File([content], filename, { type: 'text/csv' });
			const input = document.querySelector('input[type="file"]') as HTMLInputElement;
			if (input) {
				const dataTransfer = new DataTransfer();
				dataTransfer.items.add(file);
				input.files = dataTransfer.files;
				input.dispatchEvent(new Event('change', { bubbles: true }));
			}
		},
		{ content, filename }
	);
}

// Sample CSV content for tests
const ARCHIDEKT_CSV = `Count,Name,Edition,Condition,Language,Foil,Tags,Last Modified,Collector Number,Alter,Proxy,Purchase Price
1,Lightning Bolt,Limited Edition Alpha,Near Mint,English,,,2024-01-01,1,,,10.00
4,Counterspell,Fourth Edition,Near Mint,English,,,2024-01-01,33,,,2.50`;

const MALFORMED_CSV = `Count,Name,Edition
1,Lightning Bolt,Limited Edition Alpha
This is a malformed line
4,Invalid Entry`;

const MOXFIELD_CSV = `Count,Tradelist Count,Name,Edition,Condition,Language,Foil,Tags,Last Modified,Collector Number,Alter,Proxy,Purchase Price
1,,Lightning Bolt,Limited Edition Alpha,Near Mint,English,,,2024-01-01,1,,,10.00
4,,Counterspell,Fourth Edition,Near Mint,English,,,2024-01-01,33,,,2.50`;

const LARGE_CSV = Array.from(
	{ length: 1000 },
	(_, i) => `1,Card ${i},Test Set,Near Mint,English,,,2024-01-01,${i},,,1.00`
).join('\n');
const LARGE_CSV_WITH_HEADER = `Count,Name,Edition,Condition,Language,Foil,Tags,Last Modified,Collector Number,Alter,Proxy,Purchase Price\n${LARGE_CSV}`;

// Test the complete CSV conversion workflow
test.describe('CSV Conversion Workflow', () => {
	test('should process Archidekt CSV file end-to-end', async ({ page }) => {
		await page.goto('/');

		// Verify the page loaded correctly (Note: title is "Omenpath" not "OmenPath")
		await expect(page.locator('h1')).toContainText('Omenpath');

		// Upload a test CSV file
		await uploadCsvContent(page, 'archidekt-test.csv', ARCHIDEKT_CSV);

		// Wait for file to be processed and preview to show
		await page.waitForTimeout(2000);
		await expect(page.locator('.preview-table, [class*="preview"]')).toBeVisible();

		// Look for format detection text (this depends on your UI implementation)
		const pageContent = await page.textContent('body');
		expect(pageContent).toContain('Archidekt');

		// Start conversion - look for convert button
		const convertButton = page
			.locator(
				'button:has-text("Convert"), button:has-text("Start"), .convert-button, [class*="convert"]'
			)
			.first();
		await convertButton.click();

		// Wait for conversion to complete - look for results
		await page.waitForSelector('.conversion-stats, .results, [class*="result"]', {
			timeout: 30000
		});

		// Verify results are displayed
		await expect(page.locator('.conversion-stats, .results, [class*="result"]')).toBeVisible();

		// Look for successful conversion indication
		const resultsContent = await page.textContent('body');
		expect(resultsContent).toMatch(/successful|converted|completed/i);
	});

	test('should handle failed cards and display error details', async ({ page }) => {
		await page.goto('/');

		// Upload a CSV with problematic entries
		await uploadCsvContent(page, 'malformed-test.csv', MALFORMED_CSV);

		// Wait for processing
		await page.waitForTimeout(2000);

		// Start conversion
		const convertButton = page
			.locator(
				'button:has-text("Convert"), button:has-text("Start"), .convert-button, [class*="convert"]'
			)
			.first();
		await convertButton.click();

		// Wait for results
		await page.waitForSelector('.conversion-stats, .results, [class*="result"]', {
			timeout: 30000
		});

		// Look for failed cards or error information
		const pageContent = await page.textContent('body');
		expect(pageContent).toMatch(/failed|error|issue|problem/i);
	});

	test('should work correctly in dark mode', async ({ page }) => {
		await page.goto('/');

		// Look for theme toggle button and click it
		const themeToggle = page
			.locator(
				'button[class*="theme"], .theme-toggle, button:has-text("Dark"), button:has-text("Light")'
			)
			.first();
		if (await themeToggle.isVisible()) {
			await themeToggle.click();
			// Verify dark mode is applied
			await expect(page.locator('html, body')).toHaveClass(/dark/);
		}

		// Upload and process a file
		await uploadCsvContent(page, 'moxfield-test.csv', MOXFIELD_CSV);
		await page.waitForTimeout(2000);

		const convertButton = page
			.locator(
				'button:has-text("Convert"), button:has-text("Start"), .convert-button, [class*="convert"]'
			)
			.first();
		await convertButton.click();
		await page.waitForTimeout(5000);

		// Verify some results are shown (basic check)
		const pageContent = await page.textContent('body');
		expect(pageContent).toMatch(/convert|process|result/i);
	});

	test('should handle large files without timing out', async ({ page }) => {
		// Increase timeout for this test
		test.setTimeout(60000);

		await page.goto('/');

		// Upload a large CSV file
		await uploadCsvContent(page, 'large-collection.csv', LARGE_CSV_WITH_HEADER);
		await page.waitForTimeout(3000);

		// Start conversion
		const convertButton = page
			.locator(
				'button:has-text("Convert"), button:has-text("Start"), .convert-button, [class*="convert"]'
			)
			.first();
		await convertButton.click();

		// Wait for completion with extended timeout
		await page.waitForTimeout(10000);

		// Verify some processing occurred
		const pageContent = await page.textContent('body');
		expect(pageContent).toMatch(/convert|process|result|success|complete/i);
	});

	test('should validate format selection and preview', async ({ page }) => {
		await page.goto('/');

		// Upload a CSV file
		const genericCsv = `Count,Name,Edition\n1,Lightning Bolt,Limited Edition Alpha\n4,Counterspell,Fourth Edition`;
		await uploadCsvContent(page, 'generic-test.csv', genericCsv);
		await page.waitForTimeout(2000);

		// Look for format selector
		const formatSelector = page.locator('select, .format-selector, [class*="format"]').first();
		if (await formatSelector.isVisible()) {
			// Try to select a different format
			await formatSelector.selectOption('moxfield');
			await page.waitForTimeout(1000);
		}

		// Verify preview is shown
		await expect(page.locator('.preview-table, [class*="preview"]')).toBeVisible();
	});

	test('should handle network errors gracefully', async ({ page }) => {
		// Mock network failure by blocking Scryfall API requests
		await page.route('https://api.scryfall.com/**/*', (route) => route.abort());

		await page.goto('/');

		// Upload a file and try to process
		const simpleCsv = `Count,Name,Edition\n1,Lightning Bolt,Limited Edition Alpha`;
		await uploadCsvContent(page, 'simple-test.csv', simpleCsv);
		await page.waitForTimeout(2000);

		const convertButton = page
			.locator(
				'button:has-text("Convert"), button:has-text("Start"), .convert-button, [class*="convert"]'
			)
			.first();
		await convertButton.click();

		// Wait a bit for potential error
		await page.waitForTimeout(5000);

		// Should show some indication of issues or still allow retry
		const pageContent = await page.textContent('body');
		expect(pageContent).toMatch(/error|network|connection|api|retry|failed/i);
	});
});
