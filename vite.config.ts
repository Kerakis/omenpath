import { svelteTesting } from '@testing-library/svelte/vite';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const plugins: any[] = [tailwindcss(), sveltekit()];

export default defineConfig({
	plugins,
	test: {
		projects: [
			{
				extends: './vite.config.ts',
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				plugins: [svelteTesting()] as any[],
				test: {
					name: 'client',
					environment: 'jsdom',
					clearMocks: true,
					include: ['src/__tests__/components/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.ts']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/__tests__/unit/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/__tests__/components/**/*.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
