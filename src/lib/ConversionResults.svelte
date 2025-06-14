<script lang="ts">
	import { formatAsMoxfieldCSV } from './converter-engine.js';
	import type { ExportOptions } from './types.js';

	interface Props {
		results: Array<{
			filename: string;
			success: boolean;
			data?: any[];
			error?: string;
		}>;
		errors: string[];
		exportOptions?: ExportOptions;
	}
	let { results, errors, exportOptions }: Props = $props();

	// State for showing additional columns in preview
	let showAdditionalColumns = $state(false);

	// Helper function for proper pluralization
	function pluralize(count: number, singular: string, plural?: string): string {
		if (count === 1) return `${count} ${singular}`;
		return `${count} ${plural || singular + 's'}`;
	}
	function downloadCSV(result: any) {
		if (!result.data || !result.success) return;

		// Use export options if available
		const csvContent = formatAsMoxfieldCSV(result.data, exportOptions);
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');

		const url = URL.createObjectURL(blob);
		link.setAttribute('href', url);
		link.setAttribute('download', 'cards.csv');
		link.style.visibility = 'hidden';

		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}
	function downloadTXT(result: any) {
		if (!result.data || !result.success) return;

		// Sort results: low confidence first, then by name alphabetically (same as CSV)
		const sortedResults = [...result.data].sort((a: any, b: any) => {
			// First sort by confidence (low confidence first)
			const confidenceOrder: Record<string, number> = { low: 0, medium: 1, high: 2 };
			const aConfidence = confidenceOrder[a.confidence as string] ?? 2;
			const bConfidence = confidenceOrder[b.confidence as string] ?? 2;

			if (aConfidence !== bConfidence) {
				return aConfidence - bConfidence;
			}

			// Then sort alphabetically by name
			const aName = a.moxfieldRow?.Name || a.originalCard?.name || '';
			const bName = b.moxfieldRow?.Name || b.originalCard?.name || '';
			return aName.localeCompare(bName);
		});

		const txtContent = sortedResults
			.map((r: any) => {
				if (r.success) {
					// Successful card conversion
					const count = r.moxfieldRow.Count || '1';
					const name = r.moxfieldRow.Name || '';
					const setCode = r.moxfieldRow.Edition ? `(${r.moxfieldRow.Edition.toUpperCase()})` : '';
					const collectorNumber = r.moxfieldRow['Collector Number'] || '';

					// Handle foil types correctly for Moxfield format
					let foilSuffix = '';
					const foilValue = r.moxfieldRow.Foil?.toLowerCase();
					if (foilValue === 'foil' || foilValue === 'true' || foilValue === '1') {
						foilSuffix = ' *F*';
					} else if (foilValue === 'etched') {
						foilSuffix = ' *E*';
					}

					// Format: {count} {name} ({set-code}) {collector-number} *{foil-type}*
					let line = `${count} ${name}`;
					if (setCode) {
						line += ` ${setCode}`;
					}
					if (collectorNumber) {
						line += ` ${collectorNumber}`;
					}
					if (foilSuffix) {
						line += foilSuffix;
					}

					return line;
				} else {
					// Failed card - include as comment so user knows it was there
					const count = r.originalCard.count || '1';
					const name = r.originalCard.name || 'Unknown Card';
					const setCode = r.originalCard.edition ? `(${r.originalCard.edition.toUpperCase()})` : '';
					const collectorNumber = r.originalCard.collectorNumber || '';
					const foil = r.originalCard.foil || '';

					let line = `# FAILED: ${count} ${name}`;
					if (setCode) {
						line += ` ${setCode}`;
					}
					if (collectorNumber) {
						line += ` ${collectorNumber}`;
					}
					if (foil) {
						line += ` [${foil}]`;
					}
					line += ` - Error: ${r.error || 'Unknown error'}`;

					return line;
				}
			})
			.join('\n');

		const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
		const link = document.createElement('a');

		const url = URL.createObjectURL(blob);
		link.setAttribute('href', url);
		link.setAttribute('download', 'cards.txt');
		link.style.visibility = 'hidden';

		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}
	function getStats(result: any) {
		if (!result.data) return { total: 0, successful: 0, failed: 0 };

		const total = result.data.length;
		const successful = result.data.filter((r: any) => r.success).length;
		const failed = total - successful;

		return { total, successful, failed };
	}

	function getConfidenceStats(result: any) {
		if (!result.data) return { high: 0, medium: 0, low: 0, uncertain: 0 };

		const successful = result.data.filter((r: any) => r.success);
		const high = successful.filter((r: any) => r.confidence === 'high').length;
		const medium = successful.filter((r: any) => r.confidence === 'medium').length;
		const low = successful.filter((r: any) => r.confidence === 'low').length;
		const uncertain = medium + low; // Cards that might need review

		return { high, medium, low, uncertain };
	}

	function getIdentificationMethods(result: any) {
		if (!result.data) return {};

		const successful = result.data.filter((r: any) => r.success);
		const methods: Record<string, number> = {};

		successful.forEach((r: any) => {
			const method = r.identificationMethod || 'unknown';
			methods[method] = (methods[method] || 0) + 1;
		});

		return methods;
	}

	function getFailedCards(result: any) {
		if (!result.data) return [];
		return result.data.filter((r: any) => !r.success);
	}
	function getMethodLabel(method: string): string {
		const labels: Record<string, string> = {
			scryfall_id: 'Scryfall ID',
			multiverse_id: 'Multiverse ID',
			mtgo_id: 'MTGO ID',
			set_collector: 'Set + Collector #',
			name_set: 'Name + Set',
			fuzzy_set: 'Fuzzy Set Match',
			name_only: 'Name Only',
			failed: 'Failed'
		};
		return labels[method] || method;
	}
	function getSortedResults(result: any) {
		if (!result.data) return [];

		// Sort results: low confidence first, then by name alphabetically
		return [...result.data].sort((a: any, b: any) => {
			// First sort by confidence (low confidence first)
			const confidenceOrder: Record<string, number> = { low: 0, medium: 1, high: 2 };
			const aConfidence = confidenceOrder[a.confidence as string] ?? 2;
			const bConfidence = confidenceOrder[b.confidence as string] ?? 2;

			if (aConfidence !== bConfidence) {
				return aConfidence - bConfidence;
			}

			// Then sort alphabetically by name
			const aName = a.moxfieldRow?.Name || '';
			const bName = b.moxfieldRow?.Name || '';
			return aName.localeCompare(bName);
		});
	}
	function getOriginalCsvLine(card: any): string {
		if (!card.originalCard?.originalData) return '';

		// Try to reconstruct the original CSV line from the parsed data
		const data = card.originalCard.originalData;
		const values = Object.values(data).map((value: any) => {
			// Handle values that might contain commas by wrapping in quotes
			const str = String(value || '');
			if (str.includes(',') || str.includes('"') || str.includes('\n')) {
				return `"${str.replace(/"/g, '""')}"`;
			}
			return str;
		});
		return values.join(',');
	}
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
									{pluralize(stats.successful, 'card')} processed
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
										{pluralize(stats.failed, 'failed')}
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
						<div class="flex space-x-2">
							<button
								onclick={() => downloadCSV(result)}
								class="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700"
							>
								Download CSV
							</button>
							<button
								onclick={() => downloadTXT(result)}
								class="rounded bg-green-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-green-700"
							>
								Download TXT
							</button>
						</div>
					{/if}
				</div>

				{#if result.success && stats.total > 0}
					<div class="space-y-3">
						<!-- Basic Stats -->
						<div class="rounded bg-gray-50 p-3 dark:bg-gray-700">
							<div class="grid grid-cols-3 gap-4 text-sm">
								<div>
									<span class="font-medium text-gray-700 dark:text-gray-300">Total Cards:</span>
									<span class="text-gray-900 dark:text-gray-100">{stats.total}</span>
								</div>
								<div>
									<span class="font-medium text-green-700 dark:text-green-400">Successful:</span>
									<span class="text-green-900 dark:text-green-300">{stats.successful}</span>
								</div>
								<div>
									<span class="font-medium text-red-700 dark:text-red-400">Failed:</span>
									<span class="text-red-900 dark:text-red-300">{stats.failed}</span>
								</div>
							</div>
						</div>
						<!-- Confidence Warning -->
						{#if confidenceStats.uncertain > 0}
							<div class="mt-2 rounded-md border-2 border-amber-300 bg-amber-50 p-4">
								<div class="flex items-start">
									<svg
										class="mt-0.5 mr-3 h-5 w-5 flex-shrink-0 text-amber-600"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 15.5c-.77.833.192 2.5 1.732 2.5z"
										></path>
									</svg>
									<div class="text-sm">
										<p class="font-semibold text-amber-800 dark:text-amber-300">
											⚠️ {pluralize(confidenceStats.uncertain, 'card')} identified with lower confidence
										</p>
										<p class="mt-1 text-amber-700 dark:text-amber-400">
											These cards were identified using less precise methods and may not be exactly
											correct. <strong
												>Low confidence cards are automatically placed at the top of your downloaded
												CSV file</strong
											> and marked in the preview below for easy review.
										</p>
										<p class="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
											💡 Review these cards carefully before importing to ensure accuracy.
										</p>
									</div>
								</div>
							</div>
						{/if}
						<!-- Confidence Breakdown -->
						{#if stats.successful > 0}
							<div class="rounded bg-gray-50 p-3 dark:bg-gray-700">
								<h4 class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
									Identification Confidence:
								</h4>
								<div class="grid grid-cols-3 gap-4 text-sm">
									<div class="flex items-center">
										<div class="mr-2 h-3 w-3 rounded-full bg-green-500"></div>
										<span class="text-gray-700 dark:text-gray-300"
											>High: {confidenceStats.high}</span
										>
									</div>
									<div class="flex items-center">
										<div class="mr-2 h-3 w-3 rounded-full bg-yellow-500"></div>
										<span class="text-gray-700 dark:text-gray-300"
											>Medium: {confidenceStats.medium}</span
										>
									</div>
									<div class="flex items-center">
										<div class="mr-2 h-3 w-3 rounded-full bg-red-500"></div>
										<span class="text-gray-700 dark:text-gray-300">Low: {confidenceStats.low}</span>
									</div>
								</div>
							</div>
						{/if}
						<!-- Identification Methods -->
						{#if Object.keys(methods).length > 0}
							<div class="rounded bg-gray-50 p-3 dark:bg-gray-700">
								<h4 class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
									Identification Methods Used:
								</h4>
								<div class="space-y-1 text-sm text-gray-600 dark:text-gray-400">
									{#each Object.entries(methods) as [method, count]}
										<div class="flex justify-between">
											<span>{getMethodLabel(method)}:</span>
											<span class="font-medium">{count}</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Results Preview -->
						{#if stats.successful > 0}
							{@const sortedResults = getSortedResults(result)}
							<div
								class="rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-700"
							>
								<div class="mb-2 flex items-center justify-between">
									<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
										Conversion Results Preview
									</h4>
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
												Cards sorted alphabetically with the low confidence cards or errored entries
												at the top
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
													<th
														class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
														>Count</th
													>
													<th
														class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
														>Name</th
													>
													<th
														class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
														>Set</th
													>
													<th
														class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
														>CN</th
													>
													<th
														class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
														>Condition</th
													>
													<th
														class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
														>Foil</th
													>
													{#if showAdditionalColumns}
														<th
															class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
															>Alter</th
														>
														<th
															class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
															>Proxy</th
														>
														<th
															class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
															>Signed</th
														>
														<th
															class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
															>Price</th
														>
														<th
															class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
															>Lang</th
														>
														{#if exportOptions?.includeCurrentPrice}
															<th
																class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
																>Current Price</th
															>
														{/if}
														{#if exportOptions?.includeMtgoIds}
															<th
																class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
																>MTGO</th
															>
															<th
																class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
																>MTGO F</th
															>
														{/if}
														{#if exportOptions?.includeMultiverseId}
															<th
																class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
																>MV ID</th
															>
														{/if}
														{#if exportOptions?.includeTcgPlayerId}
															<th
																class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
																>TCG ID</th
															>
														{/if}
														{#if exportOptions?.includeCardMarketId}
															<th
																class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
																>CM ID</th
															>
														{/if}
													{/if}
													<th
														class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
														>Confidence</th
													>
													<th
														class="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300"
														>Method</th
													>
												</tr>
											</thead>
											<tbody>
												{#each sortedResults as card}
													<tr
														class="border-t border-gray-100 dark:border-gray-700 {card.confidence ===
														'low'
															? 'border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
															: !card.success
																? 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
																: 'bg-white dark:bg-gray-800'}"
													>
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
																<span
																	class="mr-1 text-red-600 dark:text-red-400"
																	title="Failed to convert">❌</span
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
																{card.moxfieldRow?.['Purchase Price'] ||
																	card.originalCard?.purchasePrice ||
																	'-'}
															</td>
															<td class="px-2 py-1 text-gray-600 dark:text-gray-400">
																{card.moxfieldRow?.Language || card.originalCard?.language || '-'}
															</td>
															{#if exportOptions?.includeCurrentPrice}
																<td class="px-2 py-1 text-gray-600 dark:text-gray-400">
																	{card.moxfieldRow?.['Current Price'] || '-'}
																</td>
															{/if}
															{#if exportOptions?.includeMtgoIds}
																<td class="px-2 py-1 text-gray-600 dark:text-gray-400">
																	{card.moxfieldRow?.['MTGO ID'] || '-'}
																</td>
																<td class="px-2 py-1 text-gray-600 dark:text-gray-400">
																	{card.moxfieldRow?.['MTGO Foil ID'] || '-'}
																</td>
															{/if}
															{#if exportOptions?.includeMultiverseId}
																<td class="px-2 py-1 text-gray-600 dark:text-gray-400">
																	{card.moxfieldRow?.['Multiverse ID'] || '-'}
																</td>
															{/if}
															{#if exportOptions?.includeTcgPlayerId}
																<td class="px-2 py-1 text-gray-600 dark:text-gray-400">
																	{card.moxfieldRow?.['TCGPlayer ID'] || '-'}
																</td>
															{/if}
															{#if exportOptions?.includeCardMarketId}
																<td class="px-2 py-1 text-gray-600 dark:text-gray-400">
																	{card.moxfieldRow?.['CardMarket ID'] || '-'}
																</td>
															{/if}
														{/if}
														<td class="px-2 py-1">
															<span
																class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {card.confidence ===
																'high'
																	? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
																	: card.confidence === 'medium'
																		? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
																		: card.confidence === 'low'
																			? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
																			: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}"
															>
																{card.confidence || 'unknown'}
															</span>
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
									💡 This preview shows the same order as your CSV/TXT download. You can resize this
									table by dragging the bottom edge.
									{#if confidenceStats.low > 0}
										Low confidence cards (⚠️) are at the top and highlighted in amber.
									{/if}
								</div>
							</div>
						{/if}
						<!-- Failed Cards Details -->
						{#if stats.failed > 0}
							{@const failedCards = getFailedCards(result)}
							<div class="rounded-md border border-red-200 bg-red-50 p-3">
								<h4 class="mb-2 text-sm font-medium text-red-800">
									❌ Failed Cards ({stats.failed}):
								</h4>
								<div class="mb-2 text-xs text-red-700">
									These cards failed to convert. Review the original CSV data below to identify and
									fix any issues. Common problems include missing set codes, incorrect card names,
									or invalid collector numbers.
								</div>
								<div class="max-h-64 min-h-32 resize-y space-y-2 overflow-y-auto text-sm">
									{#each failedCards as failedCard, index}
										{@const csvLine = getOriginalCsvLine(failedCard)}
										<div
											class="rounded border border-red-200 bg-white p-3 shadow-sm dark:border-red-700 dark:bg-gray-800"
										>
											<div class="flex items-start justify-between">
												<div class="font-medium text-red-900 dark:text-red-400">
													❌ {failedCard.originalCard.name || 'Unknown Card'}
													{#if failedCard.originalCard.edition}
														<span class="text-red-700 dark:text-red-400"
															>({failedCard.originalCard.edition})</span
														>
													{/if}
													{#if failedCard.originalCard.collectorNumber}
														<span class="text-red-700 dark:text-red-400"
															>#{failedCard.originalCard.collectorNumber}</span
														>
													{/if}
												</div>
												<span class="text-xs text-gray-500 dark:text-gray-400">#{index + 1}</span>
											</div>
											<div
												class="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400"
											>
												<strong>Error:</strong>
												{failedCard.error || 'Unknown error'}
											</div>
											{#if csvLine}
												<div
													class="mt-2 rounded border bg-gray-100 p-2 font-mono text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200"
												>
													<div class="mb-1 font-semibold text-red-600 dark:text-red-400">
														Original CSV line:
													</div>
													<div class="break-all">{csvLine}</div>
												</div>
											{/if}
										</div>
									{/each}
								</div>
								<div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
									💡 <strong>Tips:</strong> Check spelling, verify set codes, ensure collector numbers
									are correct
								</div>
							</div>
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
