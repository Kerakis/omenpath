<script lang="ts">
	import { onMount } from 'svelte';
	import type { ConverterEngine, ParsedCard, CsvFormat } from './types.js';
	import { createConverterEngine } from './core/converter/converter-engine.js';
	import FileUpload from './components/forms/FileUpload.svelte';
	import ConversionProgress from './components/conversion/ConversionProgress.svelte';
	import ConversionResults from './components/conversion/ConversionResults/ConversionResults.svelte';
	import FormatSelector from './components/forms/FormatSelector.svelte';
	import DataPreview from './components/conversion/DataPreview.svelte';
	import DefaultConditionSelector from './components/forms/DefaultConditionSelector.svelte';

	let engine: ConverterEngine = $state() as ConverterEngine;
	let file: File | null = $state(null); // Changed from files array to single file
	let selectedFormat: string = $state('auto'); // Default to auto-detect
	let defaultCondition: string = $state('Near Mint');
	let isConverting = $state(false);
	let conversionProgress = $state(0);
	let conversionStatus = $state('');
	let results: any[] = $state([]);
	let errors: string[] = $state([]);
	let previewData: ParsedCard[] | null = $state(null);
	let showPreview = $state(false);
	let detectedFormat: string | null = $state(null); // Track auto-detected format
	let apiHealthError: string | null = $state(null); // Track API health errors specifically
	let showPreviewButtons = $state(true); // Track whether to show buttons in preview

	// Smooth scroll utility using selectors
	function scrollToElement(selector: string) {
		setTimeout(() => {
			const element = document.querySelector(selector) as HTMLElement;
			if (element) {
				element.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		}, 100);
	}
	onMount(() => {
		engine = createConverterEngine();
	});
	// Derived state for selected format definition
	let selectedFormatDef = $derived(() => {
		if (!engine) return null;

		if (selectedFormat !== 'auto') {
			return engine.getSupportedFormats().find((f) => f.id === selectedFormat) || null;
		}

		return null;
	});

	async function handlePreview() {
		if (!file) return;
		try {
			// Auto-detect format if 'auto' is selected
			let formatToUse = selectedFormat;
			detectedFormat = null; // Reset detected format

			if (selectedFormat === 'auto') {
				const content = await file.text();
				const headers = content
					.split('\n')[0]
					.split(',')
					.map((h) => h.trim().replace(/"/g, ''));
				const detectedFormatId = engine.detectFormat(headers);
				if (detectedFormatId) {
					formatToUse = detectedFormatId;
					detectedFormat = detectedFormatId;
					console.log(`Auto-detected format: ${formatToUse}`);
				} else {
					throw new Error('Unable to auto-detect CSV format. Please select a format manually.');
				}
			} // Parse the file to get card data without API calls
			const cards = await engine.parseFile(file, formatToUse);

			// Validate set codes immediately after parsing
			const setValidation = await engine.validateSetCodes(cards);

			if (setValidation.hasInvalidSetCodes) {
				console.warn('Invalid set codes detected:', setValidation.invalidSetCodes);
			}

			previewData = cards;
			showPreview = true;
		} catch (error) {
			console.error('Preview failed:', error);
			errors.push(`Preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
	async function handleConvert() {
		if (!previewData) {
			await handlePreview();
			return;
		}

		if (!file) return;

		// Hide the action buttons once conversion starts
		showPreviewButtons = false;

		isConverting = true;
		conversionProgress = 0;
		conversionStatus = 'Starting conversion...';
		results = [];
		errors = [];
		// Keep showPreview = true so user can see parsed data vs converted data

		// Scroll to progress section
		scrollToElement('[data-section="progress"]');
		try {
			conversionStatus = `Processing ${file.name}...`;

			// Use the already validated previewData instead of re-parsing the file
			// This ensures we use the corrected set codes from validation
			const result = await engine.convertPrevalidatedCards(
				previewData,
				(progress: number) => {
					conversionProgress = progress;
				},
				defaultCondition
			);

			results.push({
				filename: file.name,
				success: true,
				data: result
			});

			conversionStatus = 'Conversion complete!';
			conversionProgress = 100; // Scroll to results section after completion
			scrollToElement('[data-section="results"]');
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			errors.push(`${file.name}: ${errorMessage}`);
			results.push({
				filename: file.name,
				success: false,
				error: errorMessage
			});
			conversionStatus = 'Conversion failed';

			// Scroll to results section even on failure
			scrollToElement('[data-section="results"]');
		} finally {
			isConverting = false;
		}
	}
	async function handleFileSelected(selectedFile: File | null) {
		file = selectedFile;
		results = [];
		errors = [];
		previewData = null;
		showPreview = false;
		detectedFormat = null; // Reset detected format when file changes
		apiHealthError = null; // Reset API health error
		showPreviewButtons = true; // Re-enable buttons when file changes

		// Check API health when a file is first selected
		if (file) {
			try {
				conversionStatus = 'Checking API availability...';
				const apiHealth = await engine.checkApiHealth();
				if (!apiHealth.available) {
					apiHealthError = `Scryfall API is not available: ${apiHealth.error || 'Unknown error'}`;
					conversionStatus = 'API unavailable';
					return;
				}
				conversionStatus = 'API available';
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				apiHealthError = `API health check failed: ${errorMessage}`;
				conversionStatus = 'API check failed';
				return;
			}

			// Automatically trigger preview after API check passes
			setTimeout(() => {
				handlePreview();
				// Smooth scroll to settings section
				scrollToElement('[data-section="settings"]');
			}, 100); // Small delay to ensure UI updates
		}
	}
	function handleFormatChange(format: string) {
		selectedFormat = format;
		previewData = null;
		showPreview = false;
		detectedFormat = null; // Reset detected format when format selection changes

		// Automatically retrigger preview when format changes
		if (file) {
			setTimeout(() => handlePreview(), 100); // Small delay to ensure UI updates
		}
	}
	function handleCancelPreview() {
		showPreview = false;
		previewData = null;
	}

	function handleConditionChange(condition: string) {
		defaultCondition = condition;
	}
</script>

<div class="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8" style="max-width: 1800px;">
	<div
		class="card-hover mb-6 rounded-lg bg-white p-6 shadow-lg transition-all duration-200 dark:bg-gray-800"
	>
		<h2 class="mb-4 text-2xl font-semibold text-gray-800 dark:text-gray-100">Upload CSV File</h2>
		<FileUpload onFileSelected={handleFileSelected} />
		{#if file}
			<div class="mt-4">
				<h3 class="mb-2 text-lg font-medium text-gray-700 dark:text-gray-200">Selected File:</h3>
				<div
					class="rounded bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-700 dark:text-gray-300"
				>
					{file.name} ({(file.size / 1024).toFixed(1)} KB)
				</div>
			</div>
		{/if}
	</div>

	<!-- API Health Error Display -->
	{#if apiHealthError}
		<div
			class="card-hover mb-6 rounded-lg border border-red-200 bg-red-50 p-6 shadow-lg dark:border-red-800 dark:bg-red-900/20"
		>
			<div class="flex items-start">
				<div class="flex-shrink-0">
					<svg
						class="h-6 w-6 text-red-600 dark:text-red-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"
						/>
					</svg>
				</div>
				<div class="ml-3">
					<h3 class="text-lg font-medium text-red-800 dark:text-red-200">API Connection Error</h3>
					<div class="mt-2 text-sm text-red-700 dark:text-red-300">
						<p>
							The Scryfall API is currently unavailable and this app cannot function without it.
						</p>
						<p class="mt-2 font-medium">
							Please try again later or check your internet connection.
						</p>
					</div>
					{#if apiHealthError.includes('API health check failed')}
						<div
							class="mt-3 rounded bg-red-100 p-2 font-mono text-xs text-red-600 dark:bg-red-800/30 dark:text-red-400"
						>
							Technical details: {apiHealthError}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	{#if file && !apiHealthError}
		<div
			data-section="settings"
			class="card-hover mb-6 rounded-lg bg-white p-6 shadow-lg transition-all duration-200 dark:bg-gray-800"
		>
			<h2 class="mb-4 text-2xl font-semibold text-gray-800 dark:text-gray-100">
				Conversion Settings
			</h2>
			<FormatSelector {selectedFormat} onFormatChange={handleFormatChange} />

			{#if selectedFormat === 'auto' && detectedFormat}
				<div class="mt-3 rounded-md bg-blue-50 p-3 dark:bg-blue-900/20">
					<div class="flex">
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
								<path
									fill-rule="evenodd"
									d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<div class="ml-3">
							<p class="text-sm text-blue-700 dark:text-blue-300">
								<strong>Format detected:</strong>
								{engine?.getSupportedFormats().find((f) => f.id === detectedFormat)?.name ||
									detectedFormat}
							</p>
						</div>
					</div>
				</div>
			{/if}

			<DefaultConditionSelector
				selectedFormat={selectedFormatDef()}
				{defaultCondition}
				onConditionChange={handleConditionChange}
			/>
		</div>
	{/if}
	{#if showPreview && previewData && !apiHealthError}
		<DataPreview
			cards={previewData}
			onProceed={handleConvert}
			onCancel={handleCancelPreview}
			showActionButtons={showPreviewButtons}
		/>
	{/if}
	{#if isConverting && !apiHealthError}
		<div data-section="progress">
			<ConversionProgress progress={conversionProgress} status={conversionStatus} />
		</div>
	{/if}

	{#if results.length > 0}
		<div data-section="results">
			<ConversionResults {results} {errors} />
		</div>
	{/if}
</div>
