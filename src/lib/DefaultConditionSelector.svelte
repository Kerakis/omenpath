<script lang="ts">
	import type { CsvFormat } from './types.js';

	export let selectedFormat: CsvFormat | null = null;
	export let defaultCondition: string = 'Near Mint';
	export let onConditionChange: (condition: string) => void = () => {};

	// Standard Moxfield conditions
	const MOXFIELD_CONDITIONS = [
		'Near Mint',
		'Lightly Played',
		'Moderately Played',
		'Heavily Played',
		'Damaged'
	];

	// Check if the selected format lacks a condition column
	$: formatLacksCondition = selectedFormat && !selectedFormat.columnMappings.condition;

	function handleConditionChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		defaultCondition = target.value;
		onConditionChange(defaultCondition);
	}
</script>

{#if formatLacksCondition}
	<div
		class="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/50"
	>
		<div
			class="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20"
		>
			<div class="mb-2 flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-200">
				<span class="text-lg">ℹ️</span>
				<strong>Default Condition Required</strong>
			</div>
			<p class="text-sm text-blue-600 dark:text-blue-300">
				The selected format ({selectedFormat?.name}) doesn't include a condition column. All cards
				will be imported with the condition you select below.
			</p>
		</div>

		<div class="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
			<label
				for="default-condition"
				class="min-w-fit font-semibold text-gray-700 dark:text-gray-200">Default Condition:</label
			>
			<select
				id="default-condition"
				value={defaultCondition}
				on:change={handleConditionChange}
				class="focus-ring w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 md:max-w-[200px] md:min-w-[150px] dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
			>
				{#each MOXFIELD_CONDITIONS as condition}
					<option value={condition}>{condition}</option>
				{/each}
			</select>
		</div>
	</div>
{/if}
