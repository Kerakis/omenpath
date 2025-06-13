<script lang="ts">
	import { onMount } from 'svelte';

	let theme = $state<'light' | 'dark' | 'system'>('system');
	let mounted = $state(false);

	// Apply theme to document
	function applyTheme(newTheme: 'light' | 'dark' | 'system') {
		if (typeof window === 'undefined') return;

		if (newTheme === 'system') {
			const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			document.documentElement.classList.toggle('dark', systemPrefersDark);
		} else {
			document.documentElement.classList.toggle('dark', newTheme === 'dark');
		}

		localStorage.setItem('theme', newTheme);
		theme = newTheme;
	}

	// Initialize theme from localStorage or system preference
	onMount(() => {
		const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
		theme = savedTheme || 'system';
		applyTheme(theme);
		mounted = true;

		// Listen for system theme changes
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleChange = () => {
			if (theme === 'system') {
				applyTheme('system');
			}
		};

		mediaQuery.addEventListener('change', handleChange);
		return () => mediaQuery.removeEventListener('change', handleChange);
	});

	function toggleTheme() {
		const themes: ('system' | 'light' | 'dark')[] = ['system', 'light', 'dark'];
		const currentIndex = themes.indexOf(theme);
		const nextTheme = themes[(currentIndex + 1) % themes.length];
		applyTheme(nextTheme);
	}
	// Get current display theme for icon
	let displayTheme = $derived(() => {
		if (!mounted) return 'system';
		if (theme === 'system') {
			return typeof window !== 'undefined' &&
				window.matchMedia('(prefers-color-scheme: dark)').matches
				? 'dark'
				: 'light';
		}
		return theme;
	});
</script>

<button
	onclick={toggleTheme}
	class="focus-ring rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
	title="Toggle theme (System: {theme === 'system' ? 'Auto' : theme})"
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
	{:else if theme === 'system'}
		<!-- System icon -->
		<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
			/>
		</svg>
	{:else if displayTheme() === 'dark'}
		<!-- Moon icon -->
		<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
			/>
		</svg>
	{:else}
		<!-- Sun icon -->
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
