<script lang="ts">
	import CsvConverter from '../lib/CsvConverter.svelte';
</script>

<div class="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8">
	<div class="container mx-auto px-4">
		<header class="mb-8 text-center">
			<h1 class="mb-4 text-4xl font-bold text-gray-800">OmenPath</h1>
			<p class="mx-auto max-w-2xl text-lg text-gray-600">
				Convert Magic: The Gathering collection CSV files from any app or website into
				Moxfield-compatible format with minimal effort.
			</p>
		</header>

		<CsvConverter />
	</div>
</div>
