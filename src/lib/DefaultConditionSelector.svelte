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
	<div class="default-condition-selector">
		<div class="info-box">
			<div class="info-header">
				<span class="info-icon">ℹ️</span>
				<strong>Default Condition Required</strong>
			</div>
			<p>
				The selected format ({selectedFormat?.name}) doesn't include a condition column. All cards
				will be imported with the condition you select below.
			</p>
		</div>

		<div class="form-group">
			<label for="default-condition">Default Condition:</label>
			<select
				id="default-condition"
				value={defaultCondition}
				on:change={handleConditionChange}
				class="condition-select"
			>
				{#each MOXFIELD_CONDITIONS as condition}
					<option value={condition}>{condition}</option>
				{/each}
			</select>
		</div>
	</div>
{/if}

<style>
	.default-condition-selector {
		margin: 1rem 0;
		padding: 1rem;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		background-color: #f8f9fa;
	}

	.info-box {
		margin-bottom: 1rem;
		padding: 0.75rem;
		background-color: #e3f2fd;
		border: 1px solid #2196f3;
		border-radius: 6px;
		color: #1565c0;
	}

	.info-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		font-weight: 600;
	}

	.info-icon {
		font-size: 1.1em;
	}

	.info-box p {
		margin: 0;
		font-size: 0.9em;
		line-height: 1.4;
	}

	.form-group {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.form-group label {
		font-weight: 600;
		color: #333;
		min-width: 120px;
	}

	.condition-select {
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		background-color: white;
		font-size: 1rem;
		min-width: 150px;
	}

	.condition-select:focus {
		outline: none;
		border-color: #2196f3;
		box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
	}

	@media (max-width: 768px) {
		.form-group {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.form-group label {
			min-width: auto;
		}

		.condition-select {
			width: 100%;
		}
	}
</style>
