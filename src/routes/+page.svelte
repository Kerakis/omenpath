<script lang="ts">
	import CsvConverter from '../lib/components/conversion/CsvConverter.svelte';
	import ThemeToggle from '../lib/components/ui/ThemeToggle.svelte';
</script>

<div
	class="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8 dark:from-gray-900 dark:to-gray-800"
>
	<div class="mx-auto max-w-none px-4 sm:px-6 lg:px-8 xl:max-w-7xl 2xl:max-w-none 2xl:px-12">
		<header class="mb-8 text-center">
			<div class="mb-4 flex items-center justify-between">
				<div class="w-10"></div>
				<!-- Spacer for centering -->
				<h1 class="text-4xl font-bold text-gray-800 dark:text-gray-100">Omenpath</h1>
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
