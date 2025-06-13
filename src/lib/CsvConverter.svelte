<script lang="ts">
	import { onMount } from 'svelte';
	import type { ConverterEngine, ParsedCard } from './types.js';
	import { createConverterEngine } from './converter-engine.js';
	import FileUpload from './FileUpload.svelte';
	import ConversionProgress from './ConversionProgress.svelte';
	import ConversionResults from './ConversionResults.svelte';
	import FormatSelector from './FormatSelector.svelte';
	import DataPreview from './DataPreview.svelte';
	let engine: ConverterEngine;
	let files: File[] = $state([]);
	let selectedFormat: string = $state('auto');
	let isConverting = $state(false);
	let conversionProgress = $state(0);
	let conversionStatus = $state('');
	let results: any[] = $state([]);
	let errors: string[] = $state([]);
	let previewData: ParsedCard[] | null = $state(null);
	let showPreview = $state(false);

	onMount(() => {
		engine = createConverterEngine();
	});
	async function handlePreview() {
		if (files.length === 0) return;

		try {
			// For now, just preview the first file
			const file = files[0];

			// Parse the file to get card data without API calls
			const cards = await engine.parseFile(file, selectedFormat);
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

		isConverting = true;
		conversionProgress = 0;
		conversionStatus = 'Starting conversion...';
		results = [];
		errors = [];
		showPreview = false;

		try {
			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				conversionStatus = `Processing ${file.name}...`;
				try {
					const result = await engine.convertFile(file, selectedFormat, (progress: number) => {
						conversionProgress = (i / files.length + progress / files.length) * 100;
					});

					results.push({
						filename: file.name,
						success: true,
						data: result
					});
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';
					errors.push(`${file.name}: ${errorMessage}`);
					results.push({
						filename: file.name,
						success: false,
						error: errorMessage
					});
				}
			}

			conversionStatus = 'Conversion complete!';
			conversionProgress = 100;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			errors.push(errorMessage);
			conversionStatus = 'Conversion failed';
		} finally {
			isConverting = false;
		}
	}
	function handleFilesSelected(selectedFiles: File[]) {
		files = selectedFiles;
		results = [];
		errors = [];
		previewData = null;
		showPreview = false;
	}

	function handleFormatChange(format: string) {
		selectedFormat = format;
		previewData = null;
		showPreview = false;
	}

	function handleCancelPreview() {
		showPreview = false;
		previewData = null;
	}
</script>

<div class="mx-auto max-w-4xl">
	<div class="card mb-6 rounded-lg bg-white p-6 shadow-lg">
		<h2 class="mb-4 text-2xl font-semibold text-gray-800">Upload CSV Files</h2>
		<FileUpload onFilesSelected={handleFilesSelected} />

		{#if files.length > 0}
			<div class="mt-4">
				<h3 class="mb-2 text-lg font-medium text-gray-700">Selected Files:</h3>
				<ul class="space-y-1">
					{#each files as file}
						<li class="rounded bg-gray-50 px-3 py-2 text-sm text-gray-600">
							{file.name} ({(file.size / 1024).toFixed(1)} KB)
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
	{#if files.length > 0}
		<div class="card mb-6 rounded-lg bg-white p-6 shadow-lg">
			<h2 class="mb-4 text-2xl font-semibold text-gray-800">Conversion Settings</h2>
			<FormatSelector {selectedFormat} onFormatChange={handleFormatChange} />
			<div class="mt-6 space-y-3">
				{#if !showPreview && !previewData}
					<button
						onclick={handlePreview}
						disabled={isConverting}
						class="w-full rounded-lg bg-green-600 px-6 py-3 font-medium text-white transition-colors hover:bg-green-700 disabled:bg-gray-400"
					>
						Preview Data
					</button>
				{/if}

				<button
					onclick={handleConvert}
					disabled={isConverting || (!previewData && !showPreview)}
					class="w-full rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400"
				>
					{isConverting
						? 'Converting...'
						: previewData
							? 'Convert to Moxfield Format'
							: 'Preview First'}
				</button>
			</div>
		</div>
	{/if}

	{#if showPreview && previewData}
		<DataPreview cards={previewData} onProceed={handleConvert} onCancel={handleCancelPreview} />
	{/if}

	{#if isConverting}
		<ConversionProgress progress={conversionProgress} status={conversionStatus} />
	{/if}

	{#if results.length > 0}
		<ConversionResults {results} {errors} />
	{/if}
</div>
