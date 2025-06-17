<script lang="ts">
	import CsvConverter from '../lib/CsvConverter.svelte';
	import ThemeToggle from '../lib/ThemeToggle.svelte';
</script>

<div
	class="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8 dark:from-gray-900 dark:to-gray-800"
>
	<div class="container mx-auto px-4">
		<header class="mb-8 text-center">
			<div class="mb-4 flex items-center justify-between">
				<div class="w-10"></div>
				<!-- Spacer for centering -->
				<h1 class="text-4xl font-bold text-gray-800 dark:text-gray-100">OmenPath</h1>
				<ThemeToggle />
			</div>
			<p class="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-300">
				Convert Magic: The Gathering collection CSV files from any app or website into
				Moxfield-compatible format with minimal effort.
			</p>
		</header>
		<script>
			// Update the HTML classes display
			const updateClasses = () => {
				const element = document.getElementById('html-classes');
				if (element) {
					element.textContent = document.documentElement.classList.toString() || 'none';
				}
			};
			updateClasses();
			// Update every 100ms to catch changes
			setInterval(updateClasses, 100);
		</script>

		<CsvConverter />
	</div>
</div>
