<script lang="ts">
	import { onMount } from 'svelte';

	let mounted = $state(false);
	let isDark = $state(false);

	function updateDarkMode() {
		isDark = document.documentElement.classList.contains('dark');
	}

	function toggleDarkMode(): void {
		const currentlyDark = document.documentElement.classList.contains('dark');
		if (currentlyDark) {
			localStorage.theme = 'light';
			document.documentElement.classList.remove('dark');
		} else {
			localStorage.theme = 'dark';
			document.documentElement.classList.add('dark');
		}
		updateDarkMode();
	}

	onMount(() => {
		updateDarkMode();
		mounted = true;
	});
</script>

<button
	onclick={toggleDarkMode}
	class="focus-ring rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
	title="Toggle theme"
	aria-label="Toggle theme"
>
	{#if !mounted}
		<!-- Loading state -->
		<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"
			/>
		</svg>
	{:else if isDark}
		<!-- Moon icon for dark mode -->
		<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M20.354 15.354A9 9 0 718.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
			/>
		</svg>
	{:else}
		<!-- Sun icon for light mode -->
		<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M8.464 4.464l.707.707m0 14.142l-.707.707M4.464 19.536l.707-.707m14.142 0l-.707.707"
			/>
		</svg>
	{/if}
</button>
