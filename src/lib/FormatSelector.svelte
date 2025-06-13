<script lang="ts">
	interface Props {
		selectedFormat: string;
		onFormatChange: (format: string) => void;
	}

	let { selectedFormat, onFormatChange }: Props = $props();
	const formats = [
		{ id: 'auto', name: 'Auto-detect', description: 'Automatically detect the CSV format' },
		{ id: 'archidekt', name: 'Archidekt', description: 'Archidekt collection export' },
		{
			id: 'cardcastle-full',
			name: 'CardCastle (Full)',
			description: 'CardCastle CSV with Scryfall IDs'
		},
		{ id: 'cardcastle-simple', name: 'CardCastle (Simple)', description: 'CardCastle Simple CSV' },
		{ id: 'cubecobra', name: 'CubeCobra', description: 'CubeCobra cube export' },
		{ id: 'deckbox', name: 'DeckBox', description: 'DeckBox inventory export' },
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
		{ id: 'mtgo-csv', name: 'MTGO (.csv)', description: 'Magic Online collection CSV export' },
		{ id: 'moxfield', name: 'Moxfield', description: 'Moxfield collection export (passthrough)' },
		{ id: 'tcgplayer', name: 'TCGPlayer', description: 'TCGPlayer collection export' }
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

		{#if selectedFormat !== 'auto'}
			{@const currentFormat = formats.find((f) => f.id === selectedFormat)}
			{#if currentFormat}
				<p class="mt-1 text-sm text-gray-500">
					{currentFormat.description}
				</p>
			{/if}
		{:else}
			<p class="mt-1 text-sm text-gray-500">
				Recommended: The system will try to automatically detect the format based on column headers.
			</p>
		{/if}
	</div>

	<div class="rounded-md border border-blue-200 bg-blue-50 p-4">
		<h4 class="mb-2 text-sm font-medium text-blue-800">💡 Tips for best results:</h4>
		<ul class="space-y-1 text-sm text-blue-700">
			<li>• Use Auto-detect for most files</li>
			<li>• Ensure your CSV files have headers</li>
			<li>• Files with Scryfall IDs will convert faster and more accurately</li>
			<li>• Large collections may take several minutes due to API rate limits</li>
		</ul>
	</div>
</div>
