<script lang="ts">
	import { onMount } from 'svelte';
	import type { ConverterEngine, ParsedCard, CsvFormat } from './types.js';
	import { createConverterEngine } from './converter-engine-new.js';
	import FileUpload from './FileUpload.svelte';
	import ConversionProgress from './ConversionProgress.svelte';
	import ConversionResults from './ConversionResults.svelte';
	import FormatSelector from './FormatSelector.svelte';
	import DataPreview from './DataPreview.svelte';
	import DefaultConditionSelector from './DefaultConditionSelector.svelte';

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
			}

			// Parse the file to get card data without API calls
			const cards = await engine.parseFile(file, formatToUse);
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

		isConverting = true;
		conversionProgress = 0;
		conversionStatus = 'Starting conversion...';
		results = [];
		errors = [];
		showPreview = false;

		// Scroll to progress section
		scrollToElement('[data-section="progress"]');
		try {
			// Use detected format if available, otherwise auto-detect or use selected format
			let formatToUse = selectedFormat;
			if (selectedFormat === 'auto') {
				if (detectedFormat) {
					// Use previously detected format
					formatToUse = detectedFormat;
				} else {
					// Auto-detect format
					const content = await file.text();
					const headers = content
						.split('\n')[0]
						.split(',')
						.map((h) => h.trim().replace(/"/g, ''));
					const detectedFormatId = engine.detectFormat(headers);
					if (detectedFormatId) {
						formatToUse = detectedFormatId;
						detectedFormat = detectedFormatId;
					} else {
						throw new Error('Unable to auto-detect CSV format. Please select a format manually.');
					}
				}
			}

			conversionStatus = `Processing ${file.name}...`;

			const result = await engine.convertFile(
				file,
				formatToUse,
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
	function handleFileSelected(selectedFile: File | null) {
		file = selectedFile;
		results = [];
		errors = [];
		previewData = null;
		showPreview = false;
		detectedFormat = null; // Reset detected format when file changes
		// Automatically trigger preview after file is selected
		if (file) {
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

<div class="mx-auto max-w-4xl">
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
	{#if file}
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

	{#if showPreview && previewData}
		<DataPreview cards={previewData} onProceed={handleConvert} onCancel={handleCancelPreview} />
	{/if}
	{#if isConverting}
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
