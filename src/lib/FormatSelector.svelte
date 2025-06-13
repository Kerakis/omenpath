<script lang="ts">
	interface Props {
		selectedFormat: string;
		onFormatChange: (format: string) => void;
	}

	let { selectedFormat, onFormatChange }: Props = $props();
	const formats = [
		// { id: 'auto', name: 'Auto-detect', description: 'Automatically detect the CSV format' }, // Temporarily disabled for testing
		{
			id: 'archidekt',
			name: 'Archidekt',
			description: 'Archidekt collection export',
			note: 'When exporting your collection from Archidekt, make sure to choose at least the following CSV fields: Quantity, Card Name, Foil, Condition, and Scryfall ID.'
		},
		{
			id: 'cardcastle-full',
			name: 'CardCastle (Full)',
			description: 'CardCastle CSV with Scryfall IDs'
		},
		{ id: 'cardcastle-simple', name: 'CardCastle (Simple)', description: 'CardCastle Simple CSV' },
		{ id: 'cubecobra', name: 'CubeCobra', description: 'CubeCobra cube export' },
		{
			id: 'deckbox',
			name: 'DeckBox',
			description: 'DeckBox inventory export',
			note: 'When exporting your collection from DeckBox, make sure to choose to include the Scryfall ID in your export.'
		},
		{ id: 'delverlens', name: 'DelverLens', description: 'DelverLens collection export' },
		{
			id: 'dragonshield-app',
			name: 'DragonShield (App)',
			description: 'DragonShield mobile app export'
		},
		{
			id: 'dragonshield-web',
			name: 'DragonShield (Web)',
			description: 'DragonShield website export'
		},
		{
			id: 'helvault',
			name: 'Helvault',
			description: 'Helvault collection export with complex tags'
		},
		{ id: 'manabox', name: 'ManaBox', description: 'ManaBox mobile app collection export' },
		{ id: 'mtgo-csv', name: 'MTGO (.csv)', description: 'Magic Online collection CSV export' },
		{ id: 'moxfield', name: 'Moxfield', description: 'Moxfield collection export (passthrough)' },
		{ id: 'tappedout', name: 'TappedOut', description: 'TappedOut inventory export' },
		{ id: 'tcgplayer', name: 'TCGPlayer', description: 'TCGPlayer collection export' },
		{ id: 'cardsphere', name: 'Cardsphere', description: 'Cardsphere collection export' },
		{
			id: 'generic',
			name: 'Generic CSV',
			description: 'Generic CSV format with common column names'
		}
	];

	function handleFormatChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		onFormatChange(target.value);
	}
</script>

<div class="space-y-4">
	<div>
		<label for="format-select" class="mb-2 block text-sm font-medium text-gray-700">
			Source Format
		</label>
		<select
			id="format-select"
			value={selectedFormat}
			onchange={handleFormatChange}
			class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		>
			{#each formats as format}
				<option value={format.id}>{format.name}</option>
			{/each}
		</select>

		{#if selectedFormat}
			{@const currentFormat = formats.find((f) => f.id === selectedFormat)}
			{#if currentFormat}
				<p class="mt-1 text-sm text-gray-500">
					{currentFormat.description}
				</p>
				{#if currentFormat.note}
					<div class="mt-2 rounded-md border border-blue-200 bg-blue-50 p-3">
						<div class="flex">
							<svg
								class="mt-0.5 mr-2 h-4 w-4 text-blue-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<p class="text-sm text-blue-700">
								<strong>Export tip:</strong>
								{currentFormat.note}
							</p>
						</div>
					</div>
				{/if}
			{/if}
		{/if}
	</div>
	<div class="rounded-md border border-blue-200 bg-blue-50 p-4">
		<h4 class="mb-2 text-sm font-medium text-blue-800">💡 Tips for best results:</h4>
		<ul class="space-y-1 text-sm text-blue-700">
			<li>• Select the format that matches your source application</li>
			<li>• Ensure your CSV files have headers</li>
			<li>• Files with Scryfall IDs will convert faster and more accurately</li>
			<li>• Large collections may take several minutes due to API rate limits</li>
		</ul>
	</div>
</div>
