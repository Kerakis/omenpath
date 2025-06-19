<script lang="ts">
	import type { ConversionResult } from '../../../types.js';
	import { getOriginalCsvLine } from '../../../utils/conversion/export-utils.js';

	interface Props {
		results: ConversionResult[];
		showAdditionalColumns: boolean;
	}

	let { results, showAdditionalColumns }: Props = $props();

	// Get failed cards (errors or warnings)
	const failedCards = $derived(() => {
		return results.filter((card) => !card.success || (card.warnings && card.warnings.length > 0));
	});
</script>

{#if failedCards().length > 0}
	<div
		class="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
	>
		<div class="mb-3 flex items-center">
			<svg
				class="mr-2 h-5 w-5 text-red-600 dark:text-red-400"
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
			<h3 class="text-lg font-semibold text-red-800 dark:text-red-300">Failed Cards Details</h3>
		</div>

		<div class="overflow-hidden rounded-md border border-red-200 dark:border-red-700">
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-red-200 dark:divide-red-700">
					<thead class="bg-red-100 dark:bg-red-800/50">
						<tr>
							<th
								class="px-4 py-3 text-left text-xs font-medium tracking-wider text-red-700 uppercase dark:text-red-300"
								>Card Name</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-medium tracking-wider text-red-700 uppercase dark:text-red-300"
								>Set</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-medium tracking-wider text-red-700 uppercase dark:text-red-300"
								>Issue</th
							>
							<th
								class="px-4 py-3 text-left text-xs font-medium tracking-wider text-red-700 uppercase dark:text-red-300"
								>Original CSV Line</th
							>
							{#if showAdditionalColumns}
								<th
									class="px-4 py-3 text-left text-xs font-medium tracking-wider text-red-700 uppercase dark:text-red-300"
									>Collector Number</th
								>
								<th
									class="px-4 py-3 text-left text-xs font-medium tracking-wider text-red-700 uppercase dark:text-red-300"
									>Language</th
								>
							{/if}
						</tr>
					</thead>
					<tbody class="divide-y divide-red-200 bg-white dark:divide-red-700 dark:bg-gray-800">
						{#each failedCards() as card, index (index)}
							<tr class="hover:bg-red-50 dark:hover:bg-red-900/10">
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
												class="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
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

		<div class="mt-3 text-sm text-red-700 dark:text-red-300">
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
					{#if failedCards().some((card) => card.warnings?.length)}
						Cards with warnings were still processed but may need review.
					{/if}
				</span>
			</p>
		</div>
	</div>
{/if}
