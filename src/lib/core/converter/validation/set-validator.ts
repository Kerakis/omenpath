import type { ParsedCard, SetValidationResult } from '../../../types.js';
import { validateSetCode, findSetCodeByName } from '../../../utils/scryfall-utils.js';

/**
 * Validates set codes in parsed cards and provides corrections for invalid ones.
 * Excludes cards with direct IDs (Scryfall, Multiverse, MTGO) from validation.
 */
export async function validateSetCodes(cards: ParsedCard[]): Promise<SetValidationResult> {
	// Filter out cards that have direct IDs - they don't need set code validation
	const cardsNeedingValidation = cards.filter((card) => {
		// Skip validation if card has any direct identifier
		const hasDirectId = !!(card.scryfallId || card.multiverseId || card.mtgoId);
		// Only validate cards without direct IDs
		return !hasDirectId;
	});

	// Debug: Add logging to see what's being validated
	console.log(
		'Set validation input (excluding cards with direct IDs):',
		cardsNeedingValidation.map((c) => ({
			name: c.name,
			edition: c.edition,
			editionName: c.editionName
		}))
	);

	const invalidSetCodes: string[] = [];
	const correctedSetCodes: Array<{
		original: string;
		corrected: string;
		confidence: number;
		setName?: string;
	}> = [];
	const warnings: string[] = [];

	// Get unique set codes from cards that need validation (including empty ones where we have set names)
	const setCodes = [...new Set(cardsNeedingValidation.map((card) => card.edition).filter(Boolean))];

	// Also collect cards that have editionName but no valid edition (and no direct IDs)
	const cardsWithOnlySetNames = cardsNeedingValidation.filter(
		(card) => card.editionName && (!card.edition || card.edition.trim() === '')
	);

	// Build correction map
	const correctionMap = new Map<string, string>();

	// Process invalid set codes
	for (const setCode of setCodes) {
		const isValid = await validateSetCode(setCode!);

		if (!isValid) {
			invalidSetCodes.push(setCode!);

			// Try to find correction using set names from cards with this set code
			const cardsWithThisSet = cardsNeedingValidation.filter((card) => card.edition === setCode);
			const setNames = [
				...new Set(cardsWithThisSet.map((card) => card.editionName).filter(Boolean))
			];
			let bestCorrection: { code: string; confidence: number; matchedName?: string } | null = null;

			for (const setName of setNames) {
				// Check if any cards with this set code are tokens or art cards
				const hasTokens = cardsWithThisSet.some(
					(card) =>
						card.isToken === 'true' ||
						card.name?.toLowerCase().includes('token') ||
						card.edition?.startsWith('T')
				);
				const hasArtCards = cardsWithThisSet.some(
					(card) =>
						card.isArtCard === 'true' ||
						card.name?.toLowerCase().includes('art card') ||
						card.edition?.startsWith('A')
				);

				const options = {
					preferTokens: hasTokens,
					preferArtSeries: hasArtCards
				};

				const correction = await findSetCodeByName(setName!, 0.7, options);

				if (
					correction.code &&
					correction.confidence >= 0.7 &&
					(!bestCorrection || correction.confidence > bestCorrection.confidence)
				) {
					bestCorrection = {
						code: correction.code,
						confidence: correction.confidence,
						matchedName: correction.matchedName
					};
				}
			}

			if (bestCorrection) {
				correctedSetCodes.push({
					original: setCode!,
					corrected: bestCorrection.code,
					confidence: bestCorrection.confidence,
					setName: bestCorrection.matchedName
				});
				correctionMap.set(setCode!, bestCorrection.code);
			} else {
				warnings.push(`Invalid set code "${setCode}" cannot be automatically corrected`);
			}
		}
	}

	// Process cards with only set names (no set codes)
	const uniqueSetNames = [...new Set(cardsWithOnlySetNames.map((card) => card.editionName!))];
	for (const setName of uniqueSetNames) {
		const correction = await findSetCodeByName(setName, 0.7);

		if (correction.code && correction.confidence >= 0.7) {
			correctedSetCodes.push({
				original: '', // No original set code
				corrected: correction.code,
				confidence: correction.confidence,
				setName: correction.matchedName
			});
			// Use setName as key for cards with no set code
			correctionMap.set(`setname:${setName}`, correction.code);
		} else {
			warnings.push(`Set name "${setName}" cannot be matched to a valid set code`);
		}
	}

	// Apply corrections to cards and update confidence levels
	// Note: Cards with direct IDs won't be affected since they're not in the correction map
	for (const card of cards) {
		applySetCorrections(card, correctionMap, correctedSetCodes);
		assignInitialConfidence(card);
	}

	return {
		hasInvalidSetCodes: invalidSetCodes.length > 0,
		invalidSetCodes,
		correctedSetCodes,
		warnings
	};
}

/**
 * Applies set corrections to a card based on the correction map.
 */
export function applySetCorrections(
	card: ParsedCard,
	correctionMap: Map<string, string>,
	correctedSetCodes: Array<{
		original: string;
		corrected: string;
		confidence: number;
		setName?: string;
	}>
) {
	if (card.edition && correctionMap.has(card.edition)) {
		// Case 1: Invalid set code that was corrected
		const correctedCode = correctionMap.get(card.edition)!;
		const correction = correctedSetCodes.find((c) => c.original === card.edition);

		card.edition = correctedCode;
		card.setCodeCorrected = true; // Flag that this set code was corrected
		card.warnings = card.warnings || [];
		card.warnings.push(
			`Set code "${correction?.original}" corrected to "${correctedCode}" based on set name "${correction?.setName}"`
		);

		// Check if this card needs token prefix after correction
		if (
			shouldAddTokenPrefix(card) &&
			!correctedCode.startsWith('t') &&
			!correctedCode.startsWith('T')
		) {
			card.edition = `t${correctedCode}`;
			card.warnings.push(
				`Added token prefix to corrected set code: ${correctedCode} → t${correctedCode}`
			);
		}
	} else if (card.editionName && (!card.edition || card.edition.trim() === '')) {
		// Case 2: Missing set code but we have set name
		const setNameKey = `setname:${card.editionName}`;
		if (correctionMap.has(setNameKey)) {
			const correctedCode = correctionMap.get(setNameKey)!;

			card.edition = correctedCode;
			card.setCodeCorrected = true; // Flag that this set code was added
			card.warnings = card.warnings || [];
			card.warnings.push(
				`Set code added as "${correctedCode}" based on set name "${card.editionName}"`
			);

			// Check if this card needs token prefix after correction
			if (
				shouldAddTokenPrefix(card) &&
				!correctedCode.startsWith('t') &&
				!correctedCode.startsWith('T')
			) {
				card.edition = `t${correctedCode}`;
				card.warnings.push(
					`Added token prefix to corrected set code: ${correctedCode} → t${correctedCode}`
				);
			}
		}
	}
}

/**
 * Determines if a card needs a token prefix based on its properties.
 */
function shouldAddTokenPrefix(card: ParsedCard): boolean {
	// Check if it's marked as a token
	if (card.isToken === 'true') {
		return true;
	}

	// Check if the name contains "Token" (common pattern in TCGPlayer data)
	if (card.name && card.name.includes(' Token')) {
		return true;
	}

	return false;
}

/**
 * Assigns initial confidence levels to cards based on available identifiers.
 */
export function assignInitialConfidence(card: ParsedCard) {
	// Update confidence levels based on identifiers and corrections
	if (card.scryfallId) {
		card.initialConfidence = 'very_high'; // Scryfall ID always wins
	} else if (card.multiverseId || card.mtgoId) {
		card.initialConfidence = 'high'; // ID-based lookups are still high
	} else if (card.edition && card.collectorNumber) {
		// Set + collector number works even without name
		if (card.setCodeCorrected) {
			// Set + collector number with corrected/added set = medium confidence
			card.initialConfidence = 'medium';
		} else {
			// Valid set + collector number = high confidence
			card.initialConfidence = 'high';
		}
		// Add warning if name is missing for set + collector number
		if (!card.name || card.name.trim() === '') {
			card.warnings = card.warnings || [];
			card.warnings.push('Missing card name - using set + collector number for lookup');
		}
	} else if (card.editionName && card.collectorNumber) {
		// Set name + collector number (with potential fuzzy set code match)
		card.initialConfidence = 'medium'; // Fuzzy match is inherently medium confidence
		// Add warning if name is missing for set name + collector number
		if (!card.name || card.name.trim() === '') {
			card.warnings = card.warnings || [];
			card.warnings.push('Missing card name - using set name + collector number for lookup');
		}
	} else if (card.edition && card.name) {
		if (card.setCodeCorrected) {
			// Name + corrected/added set = medium confidence
			card.initialConfidence = 'medium';
		} else {
			// Name + valid set = medium confidence (no correction needed)
			card.initialConfidence = 'medium';
		}
	} else if (card.name) {
		card.initialConfidence = 'low';
		// Only add "only card name available" warning if the card doesn't have collector number
		// Cards with name + collector number will be handled by special lookup
		if (!card.edition && !card.collectorNumber) {
			card.warnings = card.warnings || [];
			card.warnings.push('Only card name available - correct version unlikely to be found');
		}
	} else {
		// No name and no usable identifiers
		card.initialConfidence = 'low';
		card.warnings = card.warnings || [];

		// Check what identifiers are available to provide specific guidance
		const hasUsableIds =
			card.scryfallId ||
			card.multiverseId ||
			card.mtgoId ||
			(card.edition && card.collectorNumber) ||
			(card.editionName && card.collectorNumber);

		if (hasUsableIds) {
			// This shouldn't happen due to the logic above, but just in case
			card.warnings.push('Missing card name but other identifiers available');
		} else {
			card.warnings.push(
				'Will fail conversion - no usable identifiers available (need name, or set+collector#, or Scryfall/Multiverse/MTGO ID)'
			);
		}
	}
}
