import type { FormatDetectionResult, AutoDetector, FormatModule } from '../formats/base.js';
import type { CsvFormat } from '../../types.js';

// Import all format modules
import { manaboxModule } from '../formats/manabox.js';
import { archidektModule } from '../formats/archidekt.js';
import { deckboxModule } from '../formats/deckbox.js';
import { cardCastleFullModule, cardCastleSimpleModule } from '../formats/cardcastle.js';
import { cardsphereModule } from '../formats/cardsphere.js';
import { cubeCobraModule } from '../formats/cubecobra.js';
import { deckedBuilderModule } from '../formats/deckedbuilder.js';
import { delverLensModule } from '../formats/delverlens.js';
import { dragonShieldModule } from '../formats/dragonshield.js';
import { helvaultModule } from '../formats/helvault.js';
import { moxfieldModule } from '../formats/moxfield.js';
import { mtgoModule } from '../formats/mtgo.js';
import { tappedOutModule } from '../formats/tappedout.js';
import { tcgPlayerUserModule, tcgPlayerSellerModule } from '../formats/tcgplayer.js';
import { deckStatsModule } from '../formats/deckstats.js';
import { urzasGathererModule } from '../formats/urzasgatherer.js';

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
		tcgPlayerUserModule,
		tcgPlayerSellerModule,
		deckStatsModule,
		deckedBuilderModule,
		urzasGathererModule,

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

	getFormatModule(formatId: string): FormatModule | null {
		return this.formatModules.find((module) => module.format.id === formatId) || null;
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
