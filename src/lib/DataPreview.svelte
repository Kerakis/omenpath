<script lang="ts">
	import type { ParsedCard } from './types.js';

	interface Props {
		cards: ParsedCard[];
		onProceed: () => void;
		onCancel: () => void;
	}

	let { cards, onProceed, onCancel }: Props = $props();
	let showAdditionalColumns = $state(false);

	const totalCards = cards.length;
	const cardsWithIds = cards.filter(
		(card) => card.scryfallId || card.multiverseId || card.mtgoId
	).length;
	const cardsNeedingLookup = totalCards - cardsWithIds;

	// Helper function for proper pluralization
	function pluralize(count: number, singular: string, plural?: string): string {
		if (count === 1) return `${count} ${singular}`;
		return `${count} ${plural || singular + 's'}`;
	}
</script>

<div class="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
	<h2 class="mb-4 text-2xl font-semibold text-gray-800 dark:text-gray-200">Preview Parsed Data</h2>

	<div class="mb-6">
		<div class="grid grid-cols-3 gap-4 text-sm">
			<div class="rounded bg-blue-50 p-3 dark:bg-blue-900/20">
				<div class="font-medium text-blue-800 dark:text-blue-300">Total Cards</div>
				<div class="text-2xl font-bold text-blue-900 dark:text-blue-200">{totalCards}</div>
			</div>
			<div class="rounded bg-green-50 p-3 dark:bg-green-900/20">
				<div class="font-medium text-green-800 dark:text-green-300">Have IDs</div>
				<div class="text-2xl font-bold text-green-900 dark:text-green-200">{cardsWithIds}</div>
			</div>
			<div class="rounded bg-yellow-50 p-3 dark:bg-yellow-900/20">
				<div class="font-medium text-yellow-800 dark:text-yellow-300">Need Lookup</div>
				<div class="text-2xl font-bold text-yellow-900 dark:text-yellow-200">
					{cardsNeedingLookup}
				</div>
			</div>
		</div>
	</div>
	<div class="mb-6">
		<div class="mb-3 flex items-center justify-between">
			<h3 class="text-lg font-medium text-gray-700 dark:text-gray-300">
				All {pluralize(totalCards, 'card')}:
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
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
					{#each cards as card}
						<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
							<td class="px-3 py-2 text-sm whitespace-nowrap text-gray-900 dark:text-gray-100"
								>{card.count}</td
							>
							<td
								class="max-w-32 truncate px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
								title={card.name}
							>
								{card.name}
							</td>
							<td class="px-3 py-2 text-sm whitespace-nowrap text-gray-900 dark:text-gray-100"
								>{card.edition || '-'}</td
							>
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
									<span
										class="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300"
									>
										Needs Lookup
									</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
	<div class="space-y-4">
		{#if cardsNeedingLookup > 0}
			<div
				class="rounded-md border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-900/20"
			>
				<div class="flex">
					<svg
						class="mt-0.5 mr-2 h-5 w-5 text-yellow-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z"
						/>
					</svg>
					<div>
						<h4 class="text-sm font-medium text-yellow-800 dark:text-yellow-300">
							Cards require Scryfall lookup
						</h4>
						<p class="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
							{pluralize(cardsNeedingLookup, 'card')} don't have Scryfall IDs and will need to be looked
							up by name/set/collector number. This may take longer and could result in some cards not
							being found if the names or sets don't match exactly.
						</p>
					</div>
				</div>
			</div>
		{/if}

		<div class="flex space-x-4">
			<button
				onclick={onProceed}
				class="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
			>
				Proceed with Conversion
			</button>
			<button
				onclick={onCancel}
				class="flex-1 rounded-lg bg-gray-300 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
			>
				Cancel
			</button>
		</div>
	</div>
</div>
