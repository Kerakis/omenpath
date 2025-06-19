<script lang="ts">
	import type { ParsedCard } from '../../types.js';
	interface Props {
		cards: ParsedCard[];
		onProceed: () => void;
		onCancel: () => void;
		showActionButtons?: boolean; // New prop to control button visibility
	}
	let { cards, onProceed, onCancel, showActionButtons = true }: Props = $props();
	let showAdditionalColumns = $state(false);
	const totalEntries = cards.length;
	const totalCards = cards.reduce((sum, card) => sum + (card.count || 1), 0);
	const cardsWithSpecificIds = cards.filter(
		(card) => card.scryfallId || card.multiverseId || card.mtgoId
	).length;
	const cardsWithOtherMethods = totalEntries - cardsWithSpecificIds;

	// Helper function for proper pluralization
	function pluralize(count: number, singular: string, plural?: string): string {
		if (count === 1) return `${count} ${singular}`;
		return `${count} ${plural || singular + 's'}`;
	}

	// Function to determine the lookup method that will be used for a card
	function getLookupMethod(card: ParsedCard): string {
		if (card.scryfallId) return 'Scryfall ID';
		if (card.multiverseId) return 'Multiverse ID';
		if (card.mtgoId) return 'MTGO ID';
		if (card.edition && card.collectorNumber) return 'Set + Collector #';
		if (card.edition && card.name) return 'Name + Set';
		if (card.name && card.collectorNumber && !card.edition) return 'Name + Collector #';
		if (card.name) return 'Name Only';
		return 'Insufficient Data';
	}
</script>

<div class="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
	<h2 class="mb-4 text-2xl font-semibold text-gray-800 dark:text-gray-200">Preview Parsed Data</h2>
	<div class="mb-6">
		<div class="grid grid-cols-4 gap-4 text-sm">
			<div class="rounded bg-blue-50 p-3 dark:bg-blue-900/20">
				<div class="font-medium text-blue-800 dark:text-blue-300">Total Entries</div>
				<div class="text-2xl font-bold text-blue-900 dark:text-blue-200">{totalEntries}</div>
			</div>
			<div class="rounded bg-purple-50 p-3 dark:bg-purple-900/20">
				<div class="font-medium text-purple-800 dark:text-purple-300">Total Cards</div>
				<div class="text-2xl font-bold text-purple-900 dark:text-purple-200">{totalCards}</div>
			</div>
			<div class="rounded bg-green-50 p-3 dark:bg-green-900/20">
				<div class="font-medium text-green-800 dark:text-green-300">Direct IDs</div>
				<div class="text-2xl font-bold text-green-900 dark:text-green-200">
					{cardsWithSpecificIds}
				</div>
			</div>
			<div class="rounded bg-blue-50 p-3 dark:bg-blue-900/20">
				<div class="font-medium text-blue-800 dark:text-blue-300">Other Methods</div>
				<div class="text-2xl font-bold text-blue-900 dark:text-blue-200">
					{cardsWithOtherMethods}
				</div>
			</div>
		</div>
	</div>
	<div class="mb-6">
		<div class="mb-3 flex items-center justify-between">
			<h3 class="text-lg font-medium text-gray-700 dark:text-gray-300">
				All {pluralize(totalEntries, 'entry', 'entries')}:
			</h3>
			<button
				onclick={() => (showAdditionalColumns = !showAdditionalColumns)}
				class="text-sm text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
			>
				{showAdditionalColumns ? 'Hide' : 'Show'} additional columns
			</button>
		</div>

		<div class="max-h-96 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
			<table class="min-w-full">
				<thead class="sticky top-0 bg-gray-50 dark:bg-gray-700">
					<tr>
						<th
							class="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
							>Row</th
						>
						<th
							class="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
							>Count</th
						>
						<th
							class="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
							>Name</th
						>
						<th
							class="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
							>Set</th
						>
						<th
							class="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
							>CN</th
						>
						<th
							class="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
							>Condition</th
						>
						<th
							class="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
							>Foil</th
						>
						{#if showAdditionalColumns}
							<th
								class="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
								>Language</th
							>
							<th
								class="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
								>Alter</th
							>
							<th
								class="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
								>Proxy</th
							>
							<th
								class="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
								>Price</th
							>
						{/if}
						<th
							class="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
							>ID Status</th
						>
						<th
							class="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-300"
							>Warnings</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
					{#each cards as card, index (index)}
						<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
							<td
								class="px-3 py-2 font-mono text-sm whitespace-nowrap text-gray-500 dark:text-gray-400"
								>{card.sourceRowNumber || '-'}</td
							>
							<td class="px-3 py-2 text-sm whitespace-nowrap text-gray-900 dark:text-gray-100"
								>{card.count}</td
							>
							<td
								class="max-w-32 truncate px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
								title={card.name}
							>
								{card.name}
							</td>
							<td class="px-3 py-2 text-sm whitespace-nowrap text-gray-900 dark:text-gray-100">
								{card.edition || '-'}
								{#if card.setCodeCorrected}
									<span
										class="ml-1 inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
										title="Set code was corrected"
									>
										corrected
									</span>
								{/if}
							</td>
							<td class="px-3 py-2 text-sm whitespace-nowrap text-gray-900 dark:text-gray-100"
								>{card.collectorNumber || '-'}</td
							>
							<td class="px-3 py-2 text-sm whitespace-nowrap text-gray-900 dark:text-gray-100"
								>{card.condition || '-'}</td
							>
							<td class="px-3 py-2 text-sm whitespace-nowrap text-gray-900 dark:text-gray-100"
								>{card.foil || '-'}</td
							>
							{#if showAdditionalColumns}
								<td class="px-3 py-2 text-sm whitespace-nowrap text-gray-900 dark:text-gray-100"
									>{card.language || '-'}</td
								>
								<td class="px-3 py-2 text-sm whitespace-nowrap text-gray-900 dark:text-gray-100"
									>{card.alter || '-'}</td
								>
								<td class="px-3 py-2 text-sm whitespace-nowrap text-gray-900 dark:text-gray-100"
									>{card.proxy || '-'}</td
								>
								<td class="px-3 py-2 text-sm whitespace-nowrap text-gray-900 dark:text-gray-100"
									>{card.purchasePrice || '-'}</td
								>
							{/if}
							<td class="px-3 py-2 text-sm whitespace-nowrap">
								{#if card.scryfallId}
									<span
										class="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/50 dark:text-green-300"
									>
										Scryfall ID
									</span>
								{:else if card.multiverseId}
									<span
										class="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
									>
										Multiverse ID
									</span>
								{:else if card.mtgoId}
									<span
										class="inline-flex items-center rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
									>
										MTGO ID
									</span>
								{:else}
									{@const lookupMethod = getLookupMethod(card)}
									<span
										class="inline-flex items-center rounded-full {lookupMethod ===
										'Set + Collector #'
											? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300'
											: lookupMethod === 'Name + Set'
												? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'
												: lookupMethod === 'Name Only'
													? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
													: 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300'} px-2 py-1 text-xs font-medium"
									>
										{lookupMethod}
									</span>
								{/if}
							</td>
							<td class="max-w-48 px-3 py-2 text-sm">
								{#if card.warnings && card.warnings.length > 0}
									<div class="space-y-1">
										{#each card.warnings as warning, index (index)}
											<div
												class="rounded bg-amber-50 px-2 py-1 text-xs text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
												title={warning}
											>
												{warning.length > 60 ? warning.substring(0, 60) + '...' : warning}
											</div>
										{/each}
									</div>
								{:else}
									<span class="text-gray-400 dark:text-gray-500">-</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
	<div class="space-y-4">
		{#if cardsWithOtherMethods > 0}
			<div
				class="rounded-md border border-orange-200 bg-orange-50 p-4 dark:border-orange-700 dark:bg-orange-900/20"
			>
				<div class="flex">
					<svg
						class="mt-0.5 mr-2 h-5 w-5 text-orange-400"
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
					<div>
						<h4 class="text-sm font-medium text-orange-800 dark:text-orange-300">
							Alternative lookup methods
						</h4>
						<p class="mt-1 text-sm text-orange-700 dark:text-orange-400">
							{pluralize(cardsWithOtherMethods, 'card')} will be looked up using set/collector numbers
							and/or card names rather than direct IDs. These lookups may take slightly longer but are
							generally reliable.
						</p>
					</div>
				</div>
			</div>
		{/if}
		{#if showActionButtons}
			<div class="flex flex-col justify-center gap-4 sm:flex-row sm:justify-start">
				<button
					onclick={onProceed}
					class="min-w-fit rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
				>
					Proceed with Conversion
				</button>
				<button
					onclick={onCancel}
					class="min-w-fit rounded-lg bg-gray-300 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
				>
					Cancel
				</button>
			</div>
		{/if}
	</div>
</div>
