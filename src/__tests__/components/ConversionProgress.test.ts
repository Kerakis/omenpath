import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ConversionProgress from '../../lib/components/conversion/ConversionProgress.svelte';

describe('ConversionProgress', () => {
	it('should render with progress and status', () => {
		render(ConversionProgress, {
			props: {
				progress: 0,
				status: 'Starting conversion...'
			}
		});

		expect(screen.getByText('Converting...')).toBeDefined();
		expect(screen.getByText('Starting conversion...')).toBeDefined();
		expect(screen.getByText('0%')).toBeDefined();
	});

	it('should show correct progress percentage', () => {
		render(ConversionProgress, {
			props: {
				progress: 75.6,
				status: 'Converting cards...'
			}
		});

		// Should round the percentage
		expect(screen.getByText('76%')).toBeDefined();
		expect(screen.getByText('Converting cards...')).toBeDefined();
	});

	it('should handle 100% completion', () => {
		render(ConversionProgress, {
			props: {
				progress: 100,
				status: 'Conversion complete!'
			}
		});

		expect(screen.getByText('100%')).toBeDefined();
		expect(screen.getByText('Conversion complete!')).toBeDefined();
	});

	it('should show progress bar with correct width', () => {
		const { container } = render(ConversionProgress, {
			props: {
				progress: 50,
				status: 'Processing...'
			}
		});

		// Find the progress bar by its class
		const progressBar = container.querySelector('.progress-bar');
		expect(progressBar).toBeDefined();
		expect(progressBar?.getAttribute('style')).toContain('width: 50%');
	});

	it('should show spinner animation', () => {
		const { container } = render(ConversionProgress, {
			props: {
				progress: 50,
				status: 'Processing...'
			}
		});

		// Find the spinner by its animate-spin class
		const spinner = container.querySelector('.animate-spin');
		expect(spinner).toBeDefined();
		expect(spinner?.classList.contains('animate-spin')).toBe(true);
	});
});
