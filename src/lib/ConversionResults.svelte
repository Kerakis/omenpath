<script lang="ts">
	import { formatAsMoxfieldCSV } from './converter-engine.js';

	interface Props {
		results: Array<{
			filename: string;
			success: boolean;
			data?: any[];
			error?: string;
		}>;
		errors: string[];
	}

	let { results, errors }: Props = $props();

	function downloadCSV(result: any) {
		if (!result.data || !result.success) return;

		const csvContent = formatAsMoxfieldCSV(result.data);
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');

		const url = URL.createObjectURL(blob);
		link.setAttribute('href', url);
		link.setAttribute('download', `${result.filename.replace('.csv', '')}_moxfield.csv`);
		link.style.visibility = 'hidden';

		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}
	function downloadTXT(result: any) {
		if (!result.data || !result.success) return;

		const txtContent = result.data
			.filter((r: any) => r.success)
			.map((r: any) => {
				const count = r.moxfieldRow.Count || '1';
				const name = r.moxfieldRow.Name || '';
				const setCode = r.moxfieldRow.Edition ? `(${r.moxfieldRow.Edition.toUpperCase()})` : '';
				const collectorNumber = r.moxfieldRow['Collector Number'] || '';

				// Handle foil types correctly for Moxfield format
				let foilSuffix = '';
				const foilValue = r.moxfieldRow.Foil?.toLowerCase();
				if (foilValue === 'foil' || foilValue === 'true' || foilValue === '1') {
					foilSuffix = ' *F*';
				} else if (foilValue === 'etched') {
					foilSuffix = ' *E*';
				}

				// Format: {count} {name} ({set-code}) {collector-number} *{foil-type}*
				let line = `${count} ${name}`;
				if (setCode) {
					line += ` ${setCode}`;
				}
				if (collectorNumber) {
					line += ` ${collectorNumber}`;
				}
				if (foilSuffix) {
					line += foilSuffix;
				}

				return line;
			})
			.join('\n');

		const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
		const link = document.createElement('a');

		const url = URL.createObjectURL(blob);
		link.setAttribute('href', url);
		link.setAttribute('download', `${result.filename.replace('.csv', '')}_moxfield.txt`);
		link.style.visibility = 'hidden';

		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}
	function getStats(result: any) {
		if (!result.data) return { total: 0, successful: 0, failed: 0 };

		const total = result.data.length;
		const successful = result.data.filter((r: any) => r.success).length;
		const failed = total - successful;

		return { total, successful, failed };
	}

	function getConfidenceStats(result: any) {
		if (!result.data) return { high: 0, medium: 0, low: 0, uncertain: 0 };

		const successful = result.data.filter((r: any) => r.success);
		const high = successful.filter((r: any) => r.confidence === 'high').length;
		const medium = successful.filter((r: any) => r.confidence === 'medium').length;
		const low = successful.filter((r: any) => r.confidence === 'low').length;
		const uncertain = medium + low; // Cards that might need review

		return { high, medium, low, uncertain };
	}

	function getIdentificationMethods(result: any) {
		if (!result.data) return {};

		const successful = result.data.filter((r: any) => r.success);
		const methods: Record<string, number> = {};

		successful.forEach((r: any) => {
			const method = r.identificationMethod || 'unknown';
			methods[method] = (methods[method] || 0) + 1;
		});

		return methods;
	}

	function getMethodLabel(method: string): string {
		const labels: Record<string, string> = {
			scryfall_id: 'Scryfall ID',
			multiverse_id: 'Multiverse ID',
			mtgo_id: 'MTGO ID',
			set_collector: 'Set + Collector #',
			name_set: 'Name + Set',
			name_only: 'Name Only',
			failed: 'Failed'
		};
		return labels[method] || method;
	}
</script>

<div class="rounded-lg bg-white p-6 shadow-lg">
	<h2 class="mb-4 text-2xl font-semibold text-gray-800">Conversion Results</h2>

	{#if errors.length > 0}
		<div class="mb-6 rounded-md border border-red-200 bg-red-50 p-4">
			<h3 class="mb-2 text-lg font-medium text-red-800">⚠️ Errors</h3>
			<ul class="space-y-1 text-sm text-red-700">
				{#each errors as error}
					<li>• {error}</li>
				{/each}
			</ul>
		</div>
	{/if}
	<div class="space-y-4">
		{#each results as result}
			{@const stats = getStats(result)}
			{@const confidenceStats = getConfidenceStats(result)}
			{@const methods = getIdentificationMethods(result)}

			<div class="rounded-lg border border-gray-200 p-4">
				<div class="mb-3 flex items-start justify-between">
					<div>
						<h3 class="text-lg font-medium text-gray-800">
							{result.filename}
						</h3>

						{#if result.success}
							<div class="mt-1 flex items-center space-x-4 text-sm text-gray-600">
								<span class="flex items-center">
									<svg
										class="mr-1 h-4 w-4 text-green-500"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M5 13l4 4L19 7"
										></path>
									</svg>
									{stats.successful} cards processed
								</span>

								{#if stats.failed > 0}
									<span class="flex items-center">
										<svg
											class="mr-1 h-4 w-4 text-red-500"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M6 18L18 6M6 6l12 12"
											></path>
										</svg>
										{stats.failed} failed
									</span>
								{/if}
							</div>
						{:else}
							<div class="mt-1 flex items-center text-sm text-red-600">
								<svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M6 18L18 6M6 6l12 12"
									></path>
								</svg>
								Conversion failed: {result.error}
							</div>
						{/if}
					</div>

					{#if result.success && stats.successful > 0}
						<div class="flex space-x-2">
							<button
								onclick={() => downloadCSV(result)}
								class="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700"
							>
								Download CSV
							</button>
							<button
								onclick={() => downloadTXT(result)}
								class="rounded bg-green-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-green-700"
							>
								Download TXT
							</button>
						</div>
					{/if}
				</div>

				{#if result.success && stats.total > 0}
					<div class="space-y-3">
						<!-- Basic Stats -->
						<div class="rounded bg-gray-50 p-3">
							<div class="grid grid-cols-3 gap-4 text-sm">
								<div>
									<span class="font-medium text-gray-700">Total Cards:</span>
									<span class="text-gray-900">{stats.total}</span>
								</div>
								<div>
									<span class="font-medium text-green-700">Successful:</span>
									<span class="text-green-900">{stats.successful}</span>
								</div>
								<div>
									<span class="font-medium text-red-700">Failed:</span>
									<span class="text-red-900">{stats.failed}</span>
								</div>
							</div>
						</div>

						<!-- Confidence Warning -->
						{#if confidenceStats.uncertain > 0}
							<div class="rounded-md border border-amber-200 bg-amber-50 p-3">
								<div class="flex items-start">
									<svg
										class="mt-0.5 mr-2 h-4 w-4 flex-shrink-0 text-amber-600"
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
										<p class="font-medium text-amber-800">
											⚠️ {confidenceStats.uncertain} cards identified with lower confidence
										</p>
										<p class="mt-1 text-amber-700">
											These cards were identified using less precise methods and may not be exactly
											correct. Please review the results carefully before importing into Moxfield.
										</p>
									</div>
								</div>
							</div>
						{/if}

						<!-- Confidence Breakdown -->
						{#if stats.successful > 0}
							<div class="rounded bg-gray-50 p-3">
								<h4 class="mb-2 text-sm font-medium text-gray-700">Identification Confidence:</h4>
								<div class="grid grid-cols-3 gap-4 text-sm">
									<div class="flex items-center">
										<div class="mr-2 h-3 w-3 rounded-full bg-green-500"></div>
										<span class="text-gray-700">High: {confidenceStats.high}</span>
									</div>
									<div class="flex items-center">
										<div class="mr-2 h-3 w-3 rounded-full bg-yellow-500"></div>
										<span class="text-gray-700">Medium: {confidenceStats.medium}</span>
									</div>
									<div class="flex items-center">
										<div class="mr-2 h-3 w-3 rounded-full bg-red-500"></div>
										<span class="text-gray-700">Low: {confidenceStats.low}</span>
									</div>
								</div>
							</div>
						{/if}

						<!-- Identification Methods -->
						{#if Object.keys(methods).length > 0}
							<div class="rounded bg-gray-50 p-3">
								<h4 class="mb-2 text-sm font-medium text-gray-700">Identification Methods Used:</h4>
								<div class="space-y-1 text-sm text-gray-600">
									{#each Object.entries(methods) as [method, count]}
										<div class="flex justify-between">
											<span>{getMethodLabel(method)}:</span>
											<span class="font-medium">{count}</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						{#if stats.successful > 0}
							<div class="text-xs text-gray-600">
								Ready to import into Moxfield! Use the CSV format for the collection importer or the
								TXT format for deck lists.
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	{#if results.some((r) => r.success)}
		<div class="mt-6 rounded-md border border-green-200 bg-green-50 p-4">
			<h4 class="mb-2 text-sm font-medium text-green-800">✅ Next Steps:</h4>
			<ol class="list-inside list-decimal space-y-1 text-sm text-green-700">
				<li>Download the converted CSV file(s)</li>
				<li>
					Go to <a
						href="https://www.moxfield.com/account/collection"
						target="_blank"
						rel="noopener noreferrer"
						class="font-medium underline">Moxfield Collection</a
					>
				</li>
				<li>Click "Import" and select "CSV Import"</li>
				<li>Upload your downloaded CSV file</li>
				<li>Review and confirm the import</li>
			</ol>
		</div>
	{/if}
</div>
