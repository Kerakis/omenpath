<script lang="ts">
	import { onMount } from 'svelte';
	let mounted = $state(false);
	let theme = $state<'system' | 'light' | 'dark'>('system');

	const themeLabels = {
		system: '🌓',
		dark: '🌙',
		light: '☀️'
	};

	function updateDarkMode() {
		const currentTheme = localStorage.getItem('theme') as 'system' | 'light' | 'dark' | null;
		theme = currentTheme || 'system';

		// Apply the appropriate class based on current theme
		if (theme === 'dark') {
			document.documentElement.classList.add('dark');
		} else if (theme === 'light') {
			document.documentElement.classList.remove('dark');
		} else {
			// System preference
			const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			if (systemPrefersDark) {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}
		}
	}

	function toggleTheme(): void {
		const themes: ('system' | 'light' | 'dark')[] = ['system', 'light', 'dark'];
		const currentIndex = themes.indexOf(theme);
		const nextTheme = themes[(currentIndex + 1) % themes.length];

		localStorage.setItem('theme', nextTheme);
		theme = nextTheme;
		updateDarkMode();
	}
	onMount(() => {
		updateDarkMode();
		mounted = true;

		// Listen for system theme changes when in system mode
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleSystemChange = () => {
			if (theme === 'system') {
				updateDarkMode();
			}
		};

		mediaQuery.addEventListener('change', handleSystemChange);
		return () => mediaQuery.removeEventListener('change', handleSystemChange);
	});
</script>

<button
	onclick={toggleTheme}
	class="focus-ring rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
	title="Toggle theme ({theme})"
	aria-label="Toggle theme"
>
	{#if !mounted}
		<!-- Loading state -->
		🌓
	{:else}
		<!-- Display current theme emoji -->
		<span class="text-lg">{themeLabels[theme]}</span>
	{/if}
</button>
