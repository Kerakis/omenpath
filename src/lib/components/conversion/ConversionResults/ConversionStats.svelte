<script lang="ts">
	import { getMethodLabel, pluralize } from '../../../utils/conversion/stats-calculator.js';

	interface Stats {
		totalEntries: number;
		totalCards: number;
		successful: number;
		failed: number;
	}

	interface ConfidenceStats {
		veryHigh: number;
		high: number;
		medium: number;
		low: number;
		error: number;
		uncertain: number;
	}

	interface Props {
		stats: Stats;
		confidenceStats: ConfidenceStats;
		methods: Record<string, number>;
	}
	let { stats, confidenceStats, methods }: Props = $props();
</script>

<div class="space-y-3">
	<!-- Basic Stats -->
	<div class="rounded bg-gray-50 p-3 dark:bg-gray-700">
		<div class="grid grid-cols-4 gap-4 text-sm">
			<div>
				<span class="font-medium text-gray-700 dark:text-gray-300">Entries:</span>
				<span class="text-gray-900 dark:text-gray-100">{stats.totalEntries}</span>
			</div>
			<div>
				<span class="font-medium text-purple-700 dark:text-purple-400">Total Cards:</span>
				<span class="text-purple-900 dark:text-purple-300">{stats.totalCards}</span>
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
		<div
			class="mt-2 rounded-md border-2 border-orange-300 bg-orange-50 p-4 dark:border-orange-700 dark:bg-orange-900/20"
		>
			<div class="flex items-start">
				<svg
					class="mt-0.5 mr-3 h-5 w-5 flex-shrink-0 text-orange-600 dark:text-orange-400"
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
					<p class="font-semibold text-orange-800 dark:text-orange-300">
						⚠️ {pluralize(confidenceStats.uncertain, 'card')} need review (Medium + Low confidence +
						Errors)
					</p>
					<p class="mt-1 text-orange-700 dark:text-orange-400">
						These cards were identified using less precise methods, have conversion errors, or
						couldn't be converted. <strong
							>Cards needing review are automatically placed at the top of your downloaded CSV file</strong
						> and marked in the preview below for easy review.
					</p>
					<p class="mt-2 text-xs font-medium text-orange-600 dark:text-orange-400">
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
			<div class="grid grid-cols-2 gap-4 text-sm">
				<div class="flex items-center">
					<div class="mr-2 h-3 w-3 rounded-full bg-emerald-600"></div>
					<span class="text-gray-700 dark:text-gray-300">Very High: {confidenceStats.veryHigh}</span
					>
				</div>
				<div class="flex items-center">
					<div class="mr-2 h-3 w-3 rounded-full bg-green-500"></div>
					<span class="text-gray-700 dark:text-gray-300">High: {confidenceStats.high}</span>
				</div>
				<div class="flex items-center">
					<div class="mr-2 h-3 w-3 rounded-full bg-yellow-500"></div>
					<span class="text-gray-700 dark:text-gray-300">Medium: {confidenceStats.medium}</span>
				</div>
				<div class="flex items-center">
					<div class="mr-2 h-3 w-3 rounded-full bg-red-500"></div>
					<span class="text-gray-700 dark:text-gray-300">Low: {confidenceStats.low}</span>
				</div>
				{#if confidenceStats.error > 0}
					<div class="flex items-center">
						<div class="mr-2 h-3 w-3 rounded-full bg-red-700"></div>
						<span class="text-gray-700 dark:text-gray-300">Error: {confidenceStats.error}</span>
					</div>
				{/if}
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
				{#each Object.entries(methods) as [method, count] (method)}
					<div class="flex justify-between">
						<span>{getMethodLabel(method)}:</span>
						<span class="font-medium">{count}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
