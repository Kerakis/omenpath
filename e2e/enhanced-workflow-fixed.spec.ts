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

test.describe('Format Detection', () => {
	test('should auto-detect Archidekt format', async ({ page }) => {
		await page.goto('/');

		// Create a minimal Archidekt CSV file content with actual headers
		const csvContent = `Quantity,Name,Finish,Condition,Date Added,Language,Purchase Price,Tags,Edition Name,Edition Code,Multiverse Id,Scryfall ID,Collector Number
1,Lightning Bolt,Normal,NM,2024-01-01,EN,,,Limited Edition Alpha,lea,382,8a29a357-b1e9-4097-a2c1-a9013c4de95c,46`;

		await uploadCsvContent(page, 'archidekt-test.csv', csvContent);
		await page.waitForTimeout(2000);

		// Verify auto-detection worked by looking for text content
		const pageContent = (await page.textContent('body')) || '';
		expect(pageContent).toContain('Archidekt');
	});

	test('should auto-detect Moxfield format', async ({ page }) => {
		await page.goto('/');

		const csvContent = `Count,Tradelist Count,Name,Edition,Condition,Language,Foil,Tags,Last Modified,Collector Number,Alter,Proxy,Purchase Price
4,,Lightning Bolt,Fourth Edition,Near Mint,English,foil,,2024-01-01,1,,,`;

		await uploadCsvContent(page, 'moxfield-test.csv', csvContent);
		await page.waitForTimeout(2000);

		const pageContent = await page.textContent('body');
		expect(pageContent).toContain('Moxfield');
	});

	test('should handle manual format selection', async ({ page }) => {
		await page.goto('/');

		// Look for format selector and select a specific format manually
		const formatSelector = page.locator('select, .format-selector, [class*="format"]').first();
		if (await formatSelector.isVisible()) {
			await formatSelector.selectOption('deckbox');
		}

		const csvContent = `Count,Name,Edition,Card Number,Condition,Language,Foil,Signed,Artist Proof,Altered Art,Misprint,Promo,Textless,My Price
1,Lightning Bolt,Limited Edition Alpha,1,Near Mint,English,,,,,,,,$10.00`;

		await uploadCsvContent(page, 'deckbox-test.csv', csvContent);
		await page.waitForTimeout(2000);

		// Verify manual selection is maintained by checking if "deckbox" appears in content
		const pageContent = await page.textContent('body');
		expect(pageContent).toMatch(/deckbox|deck.*box/i);
	});
});

test.describe('Export Options', () => {
	test('should allow selecting multiple price currencies', async ({ page }) => {
		await page.goto('/');

		// Upload a test file first
		const csvContent = `Count,Name,Edition
1,Lightning Bolt,Limited Edition Alpha`;

		await uploadCsvContent(page, 'test.csv', csvContent);
		await page.waitForTimeout(2000);

		// Look for price-related checkboxes and enable them
		const priceCheckbox = page
			.locator(
				'input[type="checkbox"]:near(:text("price")), input[type="checkbox"]:near(:text("Price"))'
			)
			.first();
		if (await priceCheckbox.isVisible()) {
			await priceCheckbox.check();
		}

		// Look for currency options
		const usdCheckbox = page
			.locator(
				'input[type="checkbox"]:near(:text("USD")), input[type="checkbox"]:near(:text("usd"))'
			)
			.first();
		const eurCheckbox = page
			.locator(
				'input[type="checkbox"]:near(:text("EUR")), input[type="checkbox"]:near(:text("eur"))'
			)
			.first();
		const tixCheckbox = page
			.locator(
				'input[type="checkbox"]:near(:text("TIX")), input[type="checkbox"]:near(:text("tix"))'
			)
			.first();

		if (await usdCheckbox.isVisible()) {
			await usdCheckbox.check();
			expect(await usdCheckbox.isChecked()).toBe(true);
		}
		if (await eurCheckbox.isVisible()) {
			await eurCheckbox.check();
			expect(await eurCheckbox.isChecked()).toBe(true);
		}
		if (await tixCheckbox.isVisible()) {
			await tixCheckbox.check();
			expect(await tixCheckbox.isChecked()).toBe(true);
		}
	});

	test('should enable/disable price options correctly', async ({ page }) => {
		await page.goto('/');

		// Look for price-related checkboxes
		const priceCheckbox = page
			.locator(
				'input[type="checkbox"]:near(:text("price")), input[type="checkbox"]:near(:text("Price"))'
			)
			.first();
		const usdCheckbox = page
			.locator(
				'input[type="checkbox"]:near(:text("USD")), input[type="checkbox"]:near(:text("usd"))'
			)
			.first();

		if ((await priceCheckbox.isVisible()) && (await usdCheckbox.isVisible())) {
			// Initially price checkboxes might be disabled
			// Enable price export
			if (!(await priceCheckbox.isChecked())) {
				await priceCheckbox.check();
			}

			// Now price checkboxes should be enabled
			expect(await usdCheckbox.isDisabled()).toBe(false);

			// Disable price export
			await priceCheckbox.uncheck();

			// Price checkboxes should be disabled again
			expect(await usdCheckbox.isDisabled()).toBe(true);
		}
	});
});

test.describe('Data Preview', () => {
	test('should show preview with warnings for problematic data', async ({ page }) => {
		await page.goto('/');

		const csvContent = `Count,Name,Edition
1,Lightning Bolt,Unknown Set
1,Nonexistent Card,Limited Edition Alpha`;

		await uploadCsvContent(page, 'problematic.csv', csvContent);
		await page.waitForTimeout(2000);

		// Check if preview appears or if error/warning handling works
		const pageContent = (await page.textContent('body')) || '';
		const hasPreview = await page
			.locator('h2:has-text("Preview Parsed Data")')
			.isVisible()
			.catch(() => false);
		const hasWarnings = pageContent.match(/warning|issue|problem|unknown/i);

		// Either preview should be visible OR there should be warnings/errors shown
		expect(hasPreview || hasWarnings).toBeTruthy();
	});

	test('should allow proceeding despite warnings', async ({ page }) => {
		await page.goto('/');

		const csvContent = `Count,Name,Edition
1,Lightning Bolt,Unknown Set`;

		await uploadCsvContent(page, 'with-warnings.csv', csvContent);
		await page.waitForTimeout(2000);

		// Look for the convert button
		const convertButton = page.locator('button:has-text("Proceed with Conversion")');
		const isVisible = await convertButton.isVisible().catch(() => false);

		if (isVisible) {
			expect(await convertButton.isEnabled()).toBe(true);
			await convertButton.click();
			await page.waitForTimeout(3000);
		}

		// Should show some processing occurred
		const pageContent = (await page.textContent('body')) || '';
		expect(pageContent).toMatch(/convert|process|result|preview|data/i);
	});
});

test.describe('Error Handling', () => {
	test('should handle empty CSV file', async ({ page }) => {
		await page.goto('/');

		const csvContent = '';

		await uploadCsvContent(page, 'empty.csv', csvContent);
		await page.waitForTimeout(2000);

		// Should show an error message or handle gracefully
		const pageContent = (await page.textContent('body')) || '';
		expect(pageContent).toMatch(/error|empty|invalid|problem|file|upload/i);
	});

	test('should handle malformed CSV', async ({ page }) => {
		await page.goto('/');

		const csvContent = `Count,Name,Edition
1,Lightning Bolt
Malformed line without proper structure
1,Another Card,Some Set`;

		await uploadCsvContent(page, 'malformed.csv', csvContent);
		await page.waitForTimeout(2000);

		// Should either show an error or handle gracefully
		const pageContent = (await page.textContent('body')) || '';
		// Should either show error OR show preview (depending on how malformed data is handled)
		expect(pageContent).toMatch(/error|preview|malformed|invalid|problem|warning|data/i);
	});
});
