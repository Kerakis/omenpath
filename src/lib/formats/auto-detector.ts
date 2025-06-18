import type { FormatDetectionResult, AutoDetector, FormatModule } from './base.js';
import type { CsvFormat } from '../types.js';

// Import all format modules
import { manaboxModule } from './manabox.js';
import { archidektModule } from './archidekt.js';
import { deckboxModule } from './deckbox.js';
import { cardCastleFullModule, cardCastleSimpleModule } from './cardcastle.js';
import { cardsphereModule } from './cardsphere.js';
import { cubeCobraModule } from './cubecobra.js';
import { deckedBuilderModule } from './deckedbuilder.js';
import { delverLensModule } from './delverlens.js';
import { dragonShieldModule } from './dragonshield.js';
import { helvaultModule } from './helvault.js';
import { moxfieldModule } from './moxfield.js';
import { mtgoModule } from './mtgo.js';
import { tappedOutModule } from './tappedout.js';
import { tcgPlayerModule } from './tcgplayer.js';
import { deckStatsModule } from './deckstats.js';

class FormatAutoDetector implements AutoDetector {
	private formatModules: FormatModule[] = [
		// High-confidence formats first
		manaboxModule,
		archidektModule,
		cardCastleFullModule,
		cardsphereModule,
		cubeCobraModule,
		deckboxModule,
		delverLensModule,
		dragonShieldModule,
		helvaultModule,
		moxfieldModule,
		mtgoModule,
		tappedOutModule,
		tcgPlayerModule,
		deckStatsModule,
		deckedBuilderModule,

		// Lower confidence formats
		cardCastleSimpleModule
	];

	detectFormat(headers: string[]): FormatDetectionResult | null {
		if (!headers || headers.length === 0) {
			return null;
		}

		let bestMatch: FormatDetectionResult | null = null;
		let bestConfidence = 0;

		// Test each format module
		for (const module of this.formatModules) {
			const confidence = module.detectFormat(headers);

			if (confidence > bestConfidence) {
				const matchingHeaders = this.findMatchingHeaders(headers, module.format);
				bestMatch = {
					format: module.format,
					confidence,
					matchingHeaders
				};
				bestConfidence = confidence;
			}
		}

		// Only return a result if confidence is above a minimum threshold
		const MIN_CONFIDENCE = 0.3;
		if (bestMatch && bestMatch.confidence >= MIN_CONFIDENCE) {
			return bestMatch;
		}

		return null;
	}

	getAllFormats(): CsvFormat[] {
		return this.formatModules.map((module) => module.format);
	}

	private findMatchingHeaders(headers: string[], format: CsvFormat): string[] {
		const headerSet = new Set(headers.map((h) => h.toLowerCase()));
		const matchingHeaders: string[] = [];
		// Check which mapped columns have matching headers
		for (const [, expectedHeader] of Object.entries(format.columnMappings)) {
			if (expectedHeader && headerSet.has(expectedHeader.toLowerCase())) {
				matchingHeaders.push(expectedHeader);
			}
		}

		return matchingHeaders;
	}
}

// Export singleton instance
export const formatAutoDetector = new FormatAutoDetector();
