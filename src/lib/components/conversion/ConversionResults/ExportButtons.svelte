<script lang="ts">
	import type { ConversionResultFile } from '../../../utils/conversion/stats-calculator.js';
	import { downloadCSV, downloadTXT } from '../../../utils/conversion/export-utils.js';

	interface Props {
		result: ConversionResultFile;
	}

	let { result }: Props = $props();
</script>

{#if result.success && result.data && result.data.length > 0}
	<div class="flex flex-col gap-2 sm:flex-row">
		<button
			onclick={() => downloadCSV(result)}
			class="rounded bg-blue-600 px-3 py-1 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-blue-700"
		>
			Download CSV
		</button>
		<button
			onclick={() => downloadTXT(result)}
			class="rounded bg-green-600 px-3 py-1 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-green-700"
		>
			Download TXT
		</button>
	</div>
{/if}
