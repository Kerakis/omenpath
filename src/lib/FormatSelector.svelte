<script lang="ts">
	import { autoDetector } from './formats/index.js';

	interface Props {
		selectedFormat: string;
		onFormatChange: (format: string) => void;
	}

	let { selectedFormat, onFormatChange }: Props = $props();

	// Get all formats from the auto-detector and add the 'auto' option
	const csvFormats = autoDetector.getAllFormats();
	const formats = [
		{
			id: 'auto',
			name: 'Auto-detect',
			description: 'Automatically detect format from CSV headers'
		},
		...csvFormats.map((format) => ({
			id: format.id,
			name: format.name,
			description: format.description
		}))
	];

	function handleFormatChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		onFormatChange(target.value);
	}
</script>

<div class="space-y-4">
	<div>
		<label
			for="format-select"
			class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200"
		>
			Source Format
		</label>
		<select
			id="format-select"
			value={selectedFormat}
			onchange={handleFormatChange}
			class="focus-ring w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
		>
			{#each formats as format}
				<option value={format.id}>{format.name}</option>
			{/each}
		</select>
		{#if selectedFormat}
			{@const currentFormat = formats.find((f) => f.id === selectedFormat)}
			{#if currentFormat}
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					{currentFormat.description}
				</p>
			{/if}
		{/if}
	</div>
	<div
		class="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20"
	>
		<h4 class="mb-2 text-sm font-medium text-blue-800 dark:text-blue-200">
			💡 Tips for best results:
		</h4>
		<ul class="space-y-1 text-sm text-blue-700 dark:text-blue-200">
			<li>• Select the format that matches your source application</li>
			<li>• Ensure your CSV files have headers</li>
			<li>• Files with Scryfall IDs will convert faster and more accurately</li>
			<li>• Large collections may take several minutes due to API rate limits</li>
		</ul>
	</div>
</div>
