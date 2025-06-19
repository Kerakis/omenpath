<script lang="ts">
	import type { ConversionResult } from '../../../types.js';
	import ExportButtons from './ExportButtons.svelte';
	import ConversionStats from './ConversionStats.svelte';
	import ResultsTable from './ResultsTable.svelte';
	import FailedCardsDisplay from './FailedCardsDisplay.svelte';
	import {
		getStats,
		getConfidenceStats,
		getIdentificationMethods,
		pluralize
	} from '../../../utils/conversion/stats-calculator.js';

	interface Props {
		results: Array<{
			filename: string;
			success: boolean;
			data?: ConversionResult[];
			error?: string;
		}>;
		errors: string[];
	}
	let { results, errors }: Props = $props();

	// State for showing additional columns in preview
	let showAdditionalColumns = $state(false);
</script>

<div class="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
	<h2 class="mb-4 text-2xl font-semibold text-gray-800 dark:text-gray-200">Conversion Results</h2>

	{#if errors.length > 0}
		<div
			class="mb-6 rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-700 dark:bg-red-900/20"
		>
			<h3 class="mb-2 text-lg font-medium text-red-800 dark:text-red-300">⚠️ Errors</h3>
			<ul class="space-y-1 text-sm text-red-700 dark:text-red-400">
				{#each errors as error}
					<li>• {error}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="space-y-4">
		{#each results as result}
			{@const stats = getStats(result)}
			{@const confidenceStats = getConfidenceStats(result)}
			{@const methods = getIdentificationMethods(result)}

			<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
				<div class="mb-3 flex items-start justify-between">
					<div>
						<h3 class="text-lg font-medium text-gray-800 dark:text-gray-200">
							{result.filename}
						</h3>

						{#if result.success}
							<div
								class="mt-1 flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400"
							>
								<span class="flex items-center">
									<svg
										class="mr-1 h-4 w-4 text-green-500"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M5 13l4 4L19 7"
										></path>
									</svg>
									{pluralize(stats.totalEntries, 'entry', 'entries')} • {pluralize(
										stats.totalCards,
										'card'
									)}
								</span>

								{#if stats.failed > 0}
									<span class="flex items-center">
										<svg
											class="mr-1 h-4 w-4 text-red-500"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M6 18L18 6M6 6l12 12"
											></path>
										</svg>
										{stats.failed} failed
									</span>
								{/if}
							</div>
						{:else}
							<div class="mt-1 flex items-center text-sm text-red-600 dark:text-red-400">
								<svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M6 18L18 6M6 6l12 12"
									></path>
								</svg>
								Conversion failed: {result.error}
							</div>
						{/if}
					</div>

					{#if result.success && stats.successful > 0}
						<ExportButtons {result} />
					{/if}
				</div>

				{#if result.success && stats.totalEntries > 0}
					<div class="space-y-3">
						<!-- Conversion Stats Component -->
						<ConversionStats {stats} {confidenceStats} {methods} />

						<!-- Results Table Component -->
						{#if stats.successful > 0}
							<ResultsTable {result} bind:showAdditionalColumns />
						{/if}

						<!-- Failed Cards Display Component -->
						{#if stats.failed > 0 && result.data}
							<FailedCardsDisplay results={result.data} {showAdditionalColumns} />
						{/if}

						{#if stats.successful > 0}
							<div class="text-xs text-gray-600 dark:text-gray-400">
								Ready to import into Moxfield! Use the CSV format for the collection importer or the
								TXT format for deck lists.
							</div>
							{#if confidenceStats.low > 0}
								<div class="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
									<div class="flex items-center">
										<svg
											class="mr-1 h-4 w-4 text-amber-600"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
											></path>
										</svg>
										<span class="font-semibold text-amber-800 dark:text-amber-300">
											Low confidence cards are automatically placed at the top of your downloaded
											CSV and TXT files for easy review.
										</span>
									</div>
								</div>
							{/if}
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	{#if results.some((r) => r.success && getStats(r).successful > 0)}
		<div class="mt-6 rounded-md border border-green-200 bg-green-50 p-4">
			<h4 class="mb-2 text-sm font-medium text-green-800">✅ Next Steps:</h4>

			<div class="mb-4">
				<h5 class="mb-1 text-sm font-semibold text-green-800">For CSV Collection Import:</h5>
				<ol class="list-inside list-decimal space-y-1 text-sm text-green-700">
					<li>Download the converted CSV file.</li>
					<li>
						Go to your <a
							href="https://www.moxfield.com/collection"
							target="_blank"
							rel="noopener noreferrer"
							class="font-medium underline">Moxfield Collection</a
						>.
					</li>
					<li>Click "More" and select "Import CSV".</li>
					<li>Choose "Moxfield" as the CSV Format and upload your converted CSV file.</li>
					<li>Review and confirm the import.</li>
				</ol>
			</div>

			<div>
				<h5 class="mb-1 text-sm font-semibold text-green-800">For TXT Deck Import:</h5>
				<ol class="list-inside list-decimal space-y-1 text-sm text-green-700">
					<li>Download the converted TXT file.</li>
					<li>Go to your deck or create a new one.</li>
					<li>
						Select "From File" if creating a new deck or click "More" and then select "Import" for
						an existing deck.
					</li>
					<li>Upload your converted TXT file.</li>
					<li>Review and confirm the import.</li>
				</ol>
			</div>
		</div>
	{:else if results.length > 0}
		<div class="mt-6 rounded-md border border-red-200 bg-red-50 p-4">
			<h4 class="mb-2 text-sm font-medium text-red-800">⚠️ Conversion Issues</h4>
			<p class="mb-3 text-sm text-red-700">
				The conversion had problems processing your cards. This could be due to:
			</p>
			<ul class="mb-3 list-inside list-disc space-y-1 text-sm text-red-700">
				<li>Missing or incorrectly formatted column headers</li>
				<li>Cards not found in Scryfall database</li>
				<li>Network connectivity issues</li>
				<li>Incorrect CSV format selection</li>
			</ul>
			<p class="text-sm text-red-700">
				<strong>Try:</strong> Use the preview function to check your data format, or select a different
				CSV format from the dropdown.
			</p>
		</div>
	{/if}
</div>
