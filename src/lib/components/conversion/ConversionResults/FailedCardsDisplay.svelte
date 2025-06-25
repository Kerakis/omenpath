<script lang="ts">
	import type { ConversionResult } from '../../../types.js';
	import { getOriginalCsvLine } from '../../../utils/conversion/export-utils.js';

	interface Props {
		results: ConversionResult[];
		showAdditionalColumns: boolean;
	}

	let { results, showAdditionalColumns }: Props = $props();

	// Get cards with issues (errors first, then warnings) sorted by row number
	const cardsWithIssues = $derived(() => {
		return results
			.filter((card) => !card.success || (card.warnings && card.warnings.length > 0))
			.sort((a, b) => {
				// Sort by: errors first, then warnings, then by row number
				const aHasError = !a.success;
				const bHasError = !b.success;

				if (aHasError && !bHasError) return -1;
				if (!aHasError && bHasError) return 1;

				const rowA = a.originalCard?.sourceRowNumber || 0;
				const rowB = b.originalCard?.sourceRowNumber || 0;
				return rowA - rowB;
			});
	});
</script>

{#if cardsWithIssues().length > 0}
	<div
		class="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700"
	>
		<div class="mb-3 flex items-center">
			<svg
				class="mr-2 h-5 w-5 text-gray-600 dark:text-gray-400"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				></path>
			</svg>
			<h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200">Conversion Issues</h3>
		</div>

		<div class="overflow-hidden rounded-md border border-gray-200 dark:border-gray-600">
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
					<thead class="bg-gray-100 dark:bg-gray-600">
						<tr>
							<th
								class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-700 uppercase dark:text-gray-300"
								>Card Name</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-700 uppercase dark:text-gray-300"
								>Set</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-700 uppercase dark:text-gray-300"
								>Issue</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-700 uppercase dark:text-gray-300"
								>Original CSV Line</th
							>
							{#if showAdditionalColumns}
								<th
									class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-700 uppercase dark:text-gray-300"
									>Collector Number</th
								>
								<th
									class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-700 uppercase dark:text-gray-300"
									>Language</th
								>
							{/if}
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-600 dark:bg-gray-800">
						{#each cardsWithIssues() as card, index (index)}
							<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
								<td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
									{card.originalCard?.name || 'Unknown'}
								</td>
								<td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
									{card.originalCard?.edition || card.originalCard?.setCode || 'Unknown'}
								</td>
								<td class="px-4 py-3">
									{#if !card.success}
										<div class="flex flex-col space-y-1">
											<span
												class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/50 dark:text-red-200"
											>
												Error
											</span>
											<span class="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
												{card.error || 'Unknown error'}
											</span>
										</div>
									{:else if card.warnings?.length}
										<div class="flex flex-col space-y-1">
											<span
												class="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/50 dark:text-orange-200"
											>
												Warning
											</span>
											<span class="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
												{card.warnings.join(', ')}
											</span>
										</div>
									{/if}
								</td>
								<td class="px-4 py-3">
									<div class="space-y-1">
										{#if card.originalCard?.sourceRowNumber}
											<div class="text-xs font-medium text-blue-600 dark:text-blue-400">
												Row {card.originalCard.sourceRowNumber}
											</div>
										{/if}
										<div class="max-w-sm">
											<code
												class="block rounded bg-gray-100 px-2 py-1 text-xs break-all text-gray-800 dark:bg-gray-700 dark:text-gray-200"
											>
												{getOriginalCsvLine(card)}
											</code>
										</div>
									</div>
								</td>
								{#if showAdditionalColumns}
									<td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
										{card.originalCard?.collectorNumber || ''}
									</td>
									<td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
										{card.originalCard?.language || ''}
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<div class="mt-3 text-sm text-gray-700 dark:text-gray-300">
			<p class="flex items-start">
				<svg
					class="mt-0.5 mr-1 h-4 w-4 flex-shrink-0"
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
				<span>
					Use the row numbers to locate these entries in your original CSV file for correction.
					{#if cardsWithIssues().some((card) => card.warnings?.length)}
						Cards with warnings were still processed but may need review.
					{/if}
				</span>
			</p>
		</div>
	</div>
{/if}
