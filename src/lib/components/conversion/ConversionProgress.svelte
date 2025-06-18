<script lang="ts">
	interface Props {
		progress: number;
		status: string;
	}

	let { progress, status }: Props = $props();
</script>

<div class="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
	<h2 class="mb-4 text-2xl font-semibold text-gray-800 dark:text-gray-200">Converting...</h2>

	<div class="space-y-4">
		<div>
			<div class="mb-1 flex justify-between text-sm text-gray-600 dark:text-gray-400">
				<span>{status}</span>
				<span>{Math.round(progress)}%</span>
			</div>
			<div class="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
				<div
					class="progress-bar h-2 rounded-full bg-blue-600 dark:bg-blue-500"
					style="width: {progress}%"
				></div>
			</div>
		</div>

		<div class="flex items-center text-sm text-gray-500 dark:text-gray-400">
			<svg
				class="mr-3 -ml-1 h-4 w-4 animate-spin text-blue-600 dark:text-blue-500"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
			>
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
			Processing cards using Scryfall API...
		</div>

		<div
			class="rounded-md border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-700 dark:bg-yellow-900/20"
		>
			<p class="text-sm text-yellow-800 dark:text-yellow-300">
				<strong>Please be patient:</strong> We respect Scryfall's rate limits (10 requests/second) to
				ensure reliable service for everyone. Large collections may take several minutes to process.
			</p>
		</div>
	</div>
</div>
