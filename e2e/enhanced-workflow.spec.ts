import { test, expect } from '@playwright/test';

test.describe('Format Detection', () => {
	test('should auto-detect Archidekt format', async ({ page }) => {
		await page.goto('/');

		// Create a minimal Archidekt CSV file content
		const csvContent = `Count,Name,Edition,Condition,Language,Foil,Tags,Last Modified,Collector Number,Alter,Proxy,Purchase Price
1,Lightning Bolt,Limited Edition Alpha,Near Mint,English,,,2024-01-01,1,,,10.00`;

		// Upload the file via JavaScript evaluation to simulate file content
		await page.evaluate((content) => {
			const file = new File([content], 'archidekt-test.csv', { type: 'text/csv' });
			const input = document.querySelector('input[type="file"]') as HTMLInputElement;
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);
			input.files = dataTransfer.files;
			input.dispatchEvent(new Event('change', { bubbles: true }));
		}, csvContent);

		// Wait for format detection
		await page.waitForTimeout(1000);

		// Verify auto-detection worked
		const formatText = await page.locator('.format-detected').textContent();
		expect(formatText).toContain('Archidekt');
	});

	test('should auto-detect Moxfield format', async ({ page }) => {
		await page.goto('/');

		const csvContent = `Count,Tradelist Count,Name,Edition,Condition,Language,Foil,Tags,Last Modified,Collector Number,Alter,Proxy,Purchase Price
4,,Lightning Bolt,Fourth Edition,Near Mint,English,foil,,2024-01-01,1,,,`;

		await page.evaluate((content) => {
			const file = new File([content], 'moxfield-test.csv', { type: 'text/csv' });
			const input = document.querySelector('input[type="file"]') as HTMLInputElement;
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);
			input.files = dataTransfer.files;
			input.dispatchEvent(new Event('change', { bubbles: true }));
		}, csvContent);

		await page.waitForTimeout(1000);

		const formatText = await page.locator('.format-detected').textContent();
		expect(formatText).toContain('Moxfield');
	});

	test('should handle manual format selection', async ({ page }) => {
		await page.goto('/');

		// Select a specific format manually
		await page.selectOption('[data-testid="format-selector"]', 'deckbox');

		const csvContent = `Count,Name,Edition,Card Number,Condition,Language,Foil,Signed,Artist Proof,Altered Art,Misprint,Promo,Textless,My Price
1,Lightning Bolt,Limited Edition Alpha,1,Near Mint,English,,,,,,,,$10.00`;

		await page.evaluate((content) => {
			const file = new File([content], 'deckbox-test.csv', { type: 'text/csv' });
			const input = document.querySelector('input[type="file"]') as HTMLInputElement;
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);
			input.files = dataTransfer.files;
			input.dispatchEvent(new Event('change', { bubbles: true }));
		}, csvContent);

		await page.waitForTimeout(1000);

		// Verify manual selection is maintained
		const selectedValue = await page.locator('[data-testid="format-selector"]').inputValue();
		expect(selectedValue).toBe('deckbox');
	});
});

test.describe('Export Options', () => {
	test('should allow selecting multiple price currencies', async ({ page }) => {
		await page.goto('/');

		// Upload a test file first
		const csvContent = `Count,Name,Edition
1,Lightning Bolt,Limited Edition Alpha`;

		await page.evaluate((content) => {
			const file = new File([content], 'test.csv', { type: 'text/csv' });
			const input = document.querySelector('input[type="file"]') as HTMLInputElement;
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);
			input.files = dataTransfer.files;
			input.dispatchEvent(new Event('change', { bubbles: true }));
		}, csvContent);

		await page.waitForTimeout(1000);

		// Enable price export
		await page.check('[data-testid="include-current-price"]');

		// Select multiple currencies
		await page.check('[data-testid="price-usd"]');
		await page.check('[data-testid="price-eur"]');
		await page.check('[data-testid="price-tix"]');

		// Verify checkboxes are checked
		expect(await page.isChecked('[data-testid="price-usd"]')).toBe(true);
		expect(await page.isChecked('[data-testid="price-eur"]')).toBe(true);
		expect(await page.isChecked('[data-testid="price-tix"]')).toBe(true);
	});

	test('should enable/disable price options correctly', async ({ page }) => {
		await page.goto('/');

		// Initially price checkboxes should be disabled
		expect(await page.isDisabled('[data-testid="price-usd"]')).toBe(true);

		// Enable price export
		await page.check('[data-testid="include-current-price"]');

		// Now price checkboxes should be enabled
		expect(await page.isDisabled('[data-testid="price-usd"]')).toBe(false);
		expect(await page.isDisabled('[data-testid="price-eur"]')).toBe(false);

		// Disable price export
		await page.uncheck('[data-testid="include-current-price"]');

		// Price checkboxes should be disabled again
		expect(await page.isDisabled('[data-testid="price-usd"]')).toBe(true);
	});
});

test.describe('Data Preview', () => {
	test('should show preview with warnings for problematic data', async ({ page }) => {
		await page.goto('/');

		const csvContent = `Count,Name,Edition
1,Lightning Bolt,Unknown Set
1,Nonexistent Card,Limited Edition Alpha`;

		await page.evaluate((content) => {
			const file = new File([content], 'problematic.csv', { type: 'text/csv' });
			const input = document.querySelector('input[type="file"]') as HTMLInputElement;
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);
			input.files = dataTransfer.files;
			input.dispatchEvent(new Event('change', { bubbles: true }));
		}, csvContent);

		await page.waitForTimeout(2000);

		// Verify preview is shown
		await expect(page.locator('[data-testid="data-preview"]')).toBeVisible();

		// Look for warning indicators (this depends on your warning display implementation)
		const warningElements = page.locator('.warning, .text-orange-600, .text-orange-800');
		expect(await warningElements.count()).toBeGreaterThan(0);
	});

	test('should allow proceeding despite warnings', async ({ page }) => {
		await page.goto('/');

		const csvContent = `Count,Name,Edition
1,Lightning Bolt,Unknown Set`;

		await page.evaluate((content) => {
			const file = new File([content], 'with-warnings.csv', { type: 'text/csv' });
			const input = document.querySelector('input[type="file"]') as HTMLInputElement;
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);
			input.files = dataTransfer.files;
			input.dispatchEvent(new Event('change', { bubbles: true }));
		}, csvContent);

		await page.waitForTimeout(2000);

		// Conversion button should still be enabled despite warnings
		const convertButton = page.locator('[data-testid="convert-button"]');
		expect(await convertButton.isEnabled()).toBe(true);

		// Should be able to proceed with conversion
		await convertButton.click();

		// Wait for results
		await page.waitForSelector('[data-testid="conversion-results"]', { timeout: 30000 });
		await expect(page.locator('[data-testid="conversion-results"]')).toBeVisible();
	});
});

test.describe('Error Handling', () => {
	test('should handle empty CSV file', async ({ page }) => {
		await page.goto('/');

		const csvContent = '';

		await page.evaluate((content) => {
			const file = new File([content], 'empty.csv', { type: 'text/csv' });
			const input = document.querySelector('input[type="file"]') as HTMLInputElement;
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);
			input.files = dataTransfer.files;
			input.dispatchEvent(new Event('change', { bubbles: true }));
		}, csvContent);

		await page.waitForTimeout(1000);

		// Should show an error message
		const errorMessage = page.locator('.error-message, .text-red-600');
		await expect(errorMessage).toBeVisible();
	});

	test('should handle malformed CSV', async ({ page }) => {
		await page.goto('/');

		const csvContent = `Count,Name,Edition
1,Lightning Bolt
Malformed line without proper structure
1,Another Card,Some Set`;

		await page.evaluate((content) => {
			const file = new File([content], 'malformed.csv', { type: 'text/csv' });
			const input = document.querySelector('input[type="file"]') as HTMLInputElement;
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);
			input.files = dataTransfer.files;
			input.dispatchEvent(new Event('change', { bubbles: true }));
		}, csvContent);

		await page.waitForTimeout(2000);

		// Should either show an error or handle gracefully
		const hasError = await page.locator('.error-message, .text-red-600').isVisible();
		const hasPreview = await page.locator('[data-testid="data-preview"]').isVisible();

		// Either should show error OR show preview (depending on how malformed data is handled)
		expect(hasError || hasPreview).toBe(true);
	});
});
