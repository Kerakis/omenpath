<script lang="ts">
	import type { ConversionResult } from '../../../types.js';
	import type { ConversionResultFile } from '../../../utils/conversion/stats-calculator.js';
	import {
		getSortedResults,
		formatConfidence,
		getMethodLabel,
		getConfidenceStats
	} from '../../../utils/conversion/stats-calculator.js';

	interface Props {
		result: ConversionResultFile;
		showAdditionalColumns: boolean;
	}

	let { result, showAdditionalColumns = $bindable() }: Props = $props();

	const sortedResults = $derived(getSortedResults(result));
	const confidenceStats = $derived(getConfidenceStats(result));
</script>

<div class="rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-700">
	<div class="mb-2 flex items-center justify-between">
		<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Conversion Results Preview</h4>
		<div class="flex items-center gap-3">
			<label class="flex items-center text-xs text-gray-600 dark:text-gray-400">
				<input
					type="checkbox"
					bind:checked={showAdditionalColumns}
					class="mr-1 rounded border-gray-300 dark:border-gray-600"
				/>
				Show additional columns
			</label>
			<div class="text-xs text-gray-500 dark:text-gray-400">
				{#if confidenceStats.low > 0}
					<span class="flex items-center text-amber-600 dark:text-amber-400">
						⚠️ Low confidence cards shown first
					</span>
				{:else}
					Cards sorted alphabetically with the low confidence cards or errored entries at the top
				{/if}
			</div>
		</div>
	</div>
	<div class="overflow-x-auto">
		<div
			class="max-h-96 min-h-32 resize-y overflow-y-auto rounded border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"
		>
			<table class="min-w-full text-xs">
				<thead class="sticky top-0 bg-gray-100 dark:bg-gray-700">
					<tr>
						<th class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300">Row</th>
						<th class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300">Count</th>
						<th class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300">Name</th>
						<th class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300">Set</th>
						<th class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300">CN</th>
						<th class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
							>Condition</th
						>
						<th class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300">Foil</th>
						{#if showAdditionalColumns}
							<th class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300">Alter</th
							>
							<th class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300">Proxy</th
							>
							<th class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
								>Signed</th
							>
							<th class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300">Price</th
							>
							<th class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300">Lang</th>
						{/if}
						<th class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
							>Confidence</th
						>
						<th class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300">Method</th>
					</tr>
				</thead>
				<tbody>
					{#each sortedResults as card}
						<tr
							class="border-t border-gray-100 dark:border-gray-700 {card.confidence === 'low'
								? 'border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
								: !card.success
									? 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
									: 'bg-white dark:bg-gray-800'}"
						>
							<td class="px-2 py-1 font-mono text-xs text-gray-500 dark:text-gray-400">
								{card.outputRowNumber || '-'}
							</td>
							<td
								class="px-2 py-1 {card.confidence === 'low'
									? 'text-amber-700 dark:text-amber-400'
									: !card.success
										? 'text-red-700 dark:text-red-400'
										: 'text-gray-900 dark:text-gray-100'}"
							>
								{card.moxfieldRow?.Count || card.originalCard?.count || '1'}
							</td>
							<td
								class="px-2 py-1 font-medium {card.confidence === 'low'
									? 'text-amber-900 dark:text-amber-300'
									: !card.success
										? 'text-red-900 dark:text-red-400'
										: 'text-gray-900 dark:text-gray-100'}"
							>
								{#if card.confidence === 'low'}
									<span
										class="mr-1 text-amber-600 dark:text-amber-400"
										title="Low confidence - please review">⚠️</span
									>
								{/if}
								{#if !card.success}
									<span class="mr-1 text-red-600 dark:text-red-400" title="Failed to convert"
										>❌</span
									>
								{/if}
								{card.moxfieldRow?.Name || card.originalCard?.name || 'Unknown'}
							</td>
							<td class="px-2 py-1 text-gray-600 dark:text-gray-400">
								{card.moxfieldRow?.Edition || card.originalCard?.edition || '-'}
							</td>
							<td class="px-2 py-1 text-gray-600 dark:text-gray-400">
								{card.moxfieldRow?.['Collector Number'] ||
									card.originalCard?.collectorNumber ||
									'-'}
							</td>
							<td class="px-2 py-1 text-gray-600 dark:text-gray-400">
								{card.moxfieldRow?.Condition || card.originalCard?.condition || '-'}
							</td>
							<td class="px-2 py-1 text-gray-600 dark:text-gray-400">
								{card.moxfieldRow?.Foil || card.originalCard?.foil || '-'}
							</td>
							{#if showAdditionalColumns}
								<td class="px-2 py-1 text-gray-600 dark:text-gray-400">
									{card.moxfieldRow?.Alter || card.originalCard?.alter || '-'}
								</td>
								<td class="px-2 py-1 text-gray-600 dark:text-gray-400">
									{card.moxfieldRow?.Proxy || card.originalCard?.proxy || '-'}
								</td>
								<td class="px-2 py-1 text-gray-600 dark:text-gray-400">
									{card.moxfieldRow?.Signed || card.originalCard?.signed || '-'}
								</td>
								<td class="px-2 py-1 text-gray-600 dark:text-gray-400">
									{card.moxfieldRow?.['Purchase Price'] || card.originalCard?.purchasePrice || '-'}
								</td>
								<td class="px-2 py-1 text-gray-600 dark:text-gray-400">
									{card.moxfieldRow?.Language || card.originalCard?.language || '-'}
								</td>
							{/if}
							<td class="px-2 py-1">
								<div class="flex items-center space-x-1">
									<span
										class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {card.confidence ===
										'very_high'
											? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
											: card.confidence === 'high'
												? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
												: card.confidence === 'medium'
													? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
													: card.confidence === 'low'
														? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
														: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}"
									>
										{formatConfidence(card)}
									</span>
									{#if card.warnings && card.warnings.length > 0}
										<span
											class="inline-flex items-center text-amber-600 dark:text-amber-400"
											title="Warnings: {card.warnings.join('; ')}"
										>
											<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
												<path
													fill-rule="evenodd"
													d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
													clip-rule="evenodd"
												/>
											</svg>
										</span>
									{/if}
								</div>
							</td>
							<td class="px-2 py-1 text-gray-600 dark:text-gray-400">
								{getMethodLabel(card.identificationMethod || 'unknown')}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
	<div class="mt-2 text-xs text-gray-500">
		💡 This preview shows the same order as your CSV/TXT download. You can resize this table by
		dragging the bottom edge.
		{#if confidenceStats.low > 0}
			Low confidence cards (⚠️) are at the top and highlighted in amber.
		{/if}
	</div>
</div>
