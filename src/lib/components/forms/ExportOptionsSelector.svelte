<script lang="ts">
	import type { ExportOptions } from '../../types.js';

	interface Props {
		exportOptions: ExportOptions;
		onOptionsChange: (options: ExportOptions) => void;
	}

	let { exportOptions, onOptionsChange }: Props = $props();

	function handleOptionChange(key: keyof ExportOptions, value: boolean | string) {
		const newOptions = { ...exportOptions, [key]: value };
		onOptionsChange(newOptions);
	}
</script>

<div class="space-y-4">
	<h3 class="text-lg font-medium text-gray-700 dark:text-gray-200">Additional Export Fields</h3>
	<p class="text-sm text-gray-600 dark:text-gray-300">
		Select additional fields to include in your Moxfield export. These will be fetched from Scryfall
		during conversion.
	</p>

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<!-- Current Price Section -->
		<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-600 dark:bg-gray-700">
			<div class="mb-3">
				<label class="flex items-center space-x-2">
					<input
						type="checkbox"
						checked={exportOptions.includeCurrentPrice}
						onchange={(e) => handleOptionChange('includeCurrentPrice', e.currentTarget.checked)}
						class="focus-ring h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-600"
					/>
					<span class="text-sm font-medium text-gray-700 dark:text-gray-200"
						>Current Market Price</span
					>
				</label>
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Include current market prices from Scryfall (automatically adjusts for foil/etched)
				</p>
			</div>
			{#if exportOptions.includeCurrentPrice}
				<div class="ml-6 space-y-2">
					<div class="text-xs font-medium text-gray-600 dark:text-gray-300">Price Currency:</div>
					<div class="space-y-1">
						<label class="flex items-center space-x-2">
							<input
								type="radio"
								name="priceType"
								value="usd"
								checked={exportOptions.priceType === 'usd'}
								onchange={(e) => handleOptionChange('priceType', e.currentTarget.value)}
								class="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500"
							/>
							<span class="text-xs text-gray-700">USD ($)</span>
						</label>
						<label class="flex items-center space-x-2">
							<input
								type="radio"
								name="priceType"
								value="eur"
								checked={exportOptions.priceType === 'eur'}
								onchange={(e) => handleOptionChange('priceType', e.currentTarget.value)}
								class="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500"
							/>
							<span class="text-xs text-gray-700">EUR (€)</span>
						</label>
						<label class="flex items-center space-x-2">
							<input
								type="radio"
								name="priceType"
								value="tix"
								checked={exportOptions.priceType === 'tix'}
								onchange={(e) => handleOptionChange('priceType', e.currentTarget.value)}
								class="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500"
							/>
							<span class="text-xs text-gray-700">MTGO Tickets (TIX)</span>
						</label>
					</div>
				</div>
			{/if}
		</div>

		<!-- Card IDs Section -->
		<div class="rounded-lg border border-gray-200 p-4">
			<h4 class="mb-3 text-sm font-medium text-gray-700">Additional Card IDs</h4>
			<div class="space-y-3">
				<label class="flex items-center space-x-2">
					<input
						type="checkbox"
						checked={exportOptions.includeMtgoIds}
						onchange={(e) => handleOptionChange('includeMtgoIds', e.currentTarget.checked)}
						class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<span class="text-sm text-gray-700">MTGO ID</span>
				</label>
				<p class="ml-6 text-xs text-gray-500">Magic Online card identifier</p>

				<label class="flex items-center space-x-2">
					<input
						type="checkbox"
						checked={exportOptions.includeMultiverseId}
						onchange={(e) => handleOptionChange('includeMultiverseId', e.currentTarget.checked)}
						class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<span class="text-sm text-gray-700">Multiverse ID</span>
				</label>
				<p class="ml-6 text-xs text-gray-500">Wizards' Gatherer database ID</p>

				<label class="flex items-center space-x-2">
					<input
						type="checkbox"
						checked={exportOptions.includeTcgPlayerId}
						onchange={(e) => handleOptionChange('includeTcgPlayerId', e.currentTarget.checked)}
						class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<span class="text-sm text-gray-700">TCGPlayer ID</span>
				</label>
				<p class="ml-6 text-xs text-gray-500">TCGPlayer product identifier</p>

				<label class="flex items-center space-x-2">
					<input
						type="checkbox"
						checked={exportOptions.includeCardMarketId}
						onchange={(e) => handleOptionChange('includeCardMarketId', e.currentTarget.checked)}
						class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<span class="text-sm text-gray-700">CardMarket ID</span>
				</label>
				<p class="ml-6 text-xs text-gray-500">CardMarket (MKM) product identifier</p>
			</div>
		</div>
	</div>

	<div class="rounded-lg bg-blue-50 p-3">
		<div class="flex items-start space-x-2">
			<svg class="mt-0.5 h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
				<path
					fill-rule="evenodd"
					d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
					clip-rule="evenodd"
				/>
			</svg>
			<div class="text-xs text-blue-800">
				<p class="font-medium">Note:</p>
				<p>
					These additional fields are included for reference. Moxfield will ignore these fields
					during import, but they may be useful for your own tracking or other applications.
				</p>
			</div>
		</div>
	</div>
</div>
