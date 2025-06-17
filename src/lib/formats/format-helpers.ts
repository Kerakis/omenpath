import type { CsvFormat } from '../types.js';
import type { FormatModule } from './base.js';

// Helper function to create format modules with standard detection logic
export function createStandardFormatModule(
	format: CsvFormat,
	strongIndicators: string[] = [],
	commonIndicators: string[] = [],
	requiredHeaders: string[] = []
): FormatModule {
	return {
		format,
		detectFormat: (headers: string[]): number => {
			const headerSet = new Set(headers.map((h) => h.toLowerCase()));

			// Check required headers first
			if (requiredHeaders.length > 0) {
				const hasRequired = requiredHeaders.every((h) => headerSet.has(h));
				if (!hasRequired) return 0;
			}

			let score = 0;
			let strongMatches = 0;

			// Check strong indicators (highly weighted)
			for (const indicator of strongIndicators) {
				if (headerSet.has(indicator.toLowerCase())) {
					strongMatches++;
					score += 0.3;
				}
			}

			// Check common indicators
			for (const indicator of commonIndicators) {
				if (headerSet.has(indicator.toLowerCase())) {
					score += 0.1;
				}
			}

			// Bonus for having strong indicators
			if (strongMatches > 0) {
				score += 0.2;
			}

			return Math.min(score, 1.0);
		}
	};
}
