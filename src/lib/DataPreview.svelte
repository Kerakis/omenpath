<script lang="ts">
	import type { ParsedCard } from './types.js';

	interface Props {
		cards: ParsedCard[];
		onProceed: () => void;
		onCancel: () => void;
	}

	let { cards, onProceed, onCancel }: Props = $props();

	// Show first 5 cards as preview
	const previewCards = cards.slice(0, 5);
	const totalCards = cards.length;
	const cardsWithIds = cards.filter(
		(card) => card.scryfallId || card.multiverseId || card.mtgoId
	).length;
	const cardsNeedingLookup = totalCards - cardsWithIds;
</script>

<div class="rounded-lg bg-white p-6 shadow-lg">
	<h2 class="mb-4 text-2xl font-semibold text-gray-800">Preview Parsed Data</h2>

	<div class="mb-6">
		<div class="grid grid-cols-3 gap-4 text-sm">
			<div class="rounded bg-blue-50 p-3">
				<div class="font-medium text-blue-800">Total Cards</div>
				<div class="text-2xl font-bold text-blue-900">{totalCards}</div>
			</div>
			<div class="rounded bg-green-50 p-3">
				<div class="font-medium text-green-800">Have IDs</div>
				<div class="text-2xl font-bold text-green-900">{cardsWithIds}</div>
			</div>
			<div class="rounded bg-yellow-50 p-3">
				<div class="font-medium text-yellow-800">Need Lookup</div>
				<div class="text-2xl font-bold text-yellow-900">{cardsNeedingLookup}</div>
			</div>
		</div>
	</div>

	<div class="mb-6">
		<h3 class="mb-3 text-lg font-medium text-gray-700">Sample Cards (first 5):</h3>
		<div class="overflow-x-auto">
			<table class="min-w-full overflow-hidden rounded-lg border border-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th
							class="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Count</th
						>
						<th
							class="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Name</th
						>
						<th
							class="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Set</th
						>
						<th
							class="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>CN</th
						>
						<th
							class="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Condition</th
						>
						<th
							class="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>Foil</th
						>
						<th
							class="px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
							>ID Status</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 bg-white">
					{#each previewCards as card}
						<tr>
							<td class="px-3 py-2 text-sm whitespace-nowrap text-gray-900">{card.count}</td>
							<td
								class="max-w-32 truncate px-3 py-2 text-sm whitespace-nowrap text-gray-900"
								title={card.name}
							>
								{card.name}
							</td>
							<td class="px-3 py-2 text-sm whitespace-nowrap text-gray-900"
								>{card.edition || '-'}</td
							>
							<td class="px-3 py-2 text-sm whitespace-nowrap text-gray-900"
								>{card.collectorNumber || '-'}</td
							>
							<td class="px-3 py-2 text-sm whitespace-nowrap text-gray-900"
								>{card.condition || '-'}</td
							>
							<td class="px-3 py-2 text-sm whitespace-nowrap text-gray-900">{card.foil || '-'}</td>
							<td class="px-3 py-2 text-sm whitespace-nowrap">
								{#if card.scryfallId}
									<span
										class="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800"
									>
										Scryfall ID
									</span>
								{:else if card.multiverseId}
									<span
										class="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
									>
										Multiverse ID
									</span>
								{:else if card.mtgoId}
									<span
										class="inline-flex items-center rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800"
									>
										MTGO ID
									</span>
								{:else}
									<span
										class="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800"
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

		{#if totalCards > 5}
			<p class="mt-2 text-sm text-gray-500">
				...and {totalCards - 5} more cards
			</p>
		{/if}
	</div>

	<div class="space-y-4">
		{#if cardsNeedingLookup > 0}
			<div class="rounded-md border border-yellow-200 bg-yellow-50 p-4">
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
						<h4 class="text-sm font-medium text-yellow-800">Cards require Scryfall lookup</h4>
						<p class="mt-1 text-sm text-yellow-700">
							{cardsNeedingLookup} cards don't have Scryfall IDs and will need to be looked up by name/set/collector
							number. This may take longer and could result in some cards not being found if the names
							or sets don't match exactly.
						</p>
					</div>
				</div>
			</div>
		{/if}

		<div class="flex space-x-4">
			<button
				onclick={onProceed}
				class="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
			>
				Proceed with Conversion
			</button>
			<button
				onclick={onCancel}
				class="flex-1 rounded-lg bg-gray-300 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-400"
			>
				Cancel
			</button>
		</div>
	</div>
</div>
