import type { ParsedCard, ScryfallCard, ConversionResult } from '../../types.js';
import { getLanguageDisplayName } from './api/language-validator.js';

/**
 * Helper function to convert ParsedCard to Moxfield row format
 */
function convertCardToMoxfieldRow(
	card: ParsedCard,
	scryfallCard?: ScryfallCard,
	defaultCondition?: string
): Record<string, string> {
	// If we have Scryfall data, use it to fill in missing information
	const edition = card.edition || scryfallCard?.set || '';
	const collectorNumber = card.collectorNumber || scryfallCard?.collector_number || '';
	const name = card.name || scryfallCard?.name || '';

	// Use the actual language from Scryfall if available, otherwise fall back to original
	const language = scryfallCard?.lang
		? getLanguageDisplayName(scryfallCard.lang)
		: card.language || 'English';

	return {
		Count: card.count.toString(),
		Name: name,
		Edition: edition,
		Condition: card.condition || defaultCondition || 'Near Mint',
		Language: language,
		Foil: card.foil || '',
		'Last Modified': card.lastModified || '',
		'Collector Number': collectorNumber,
		Alter: card.alter || 'FALSE',
		Proxy: card.proxy || 'FALSE',
		Signed: card.signed || 'FALSE',
		'Purchase Price': card.purchasePrice || ''
	};
}

/**
 * Helper to create successful result
 */
export function createSuccessfulResult(
	card: ParsedCard,
	scryfallCard: ScryfallCard
): ConversionResult {
	// Start with the initial confidence (from parsing/validation phase)
	let confidence = card.initialConfidence || 'low';
	let identificationMethod: ConversionResult['identificationMethod'] = 'name_only';

	// Determine identification method based on what was actually used
	if (card.foundViaNameCollectorSearch) {
		// Special case: Card found via name + collector number search
		identificationMethod = 'name_collector';
		// Keep the medium confidence already set, don't upgrade to very_high
		confidence = card.initialConfidence || 'medium';
	} else if (card.scryfallId) {
		identificationMethod = 'scryfall_id';
		// Very high confidence can't be downgraded by other factors
		confidence = 'very_high';
	} else if (card.multiverseId) {
		identificationMethod = 'multiverse_id';
		// Start with high confidence, but check for downgrades
		if (confidence === 'very_high') confidence = 'high'; // Can't be higher than high for multiverse ID
	} else if (card.mtgoId) {
		identificationMethod = 'mtgo_id';
		// Start with high confidence, but check for downgrades
		if (confidence === 'very_high') confidence = 'high'; // Can't be higher than high for MTGO ID
	} else if (card.edition && card.collectorNumber) {
		if (card.setCodeCorrected) {
			identificationMethod = 'set_collector_corrected';
			// Medium confidence for corrected set codes (as per requirements)
			if (confidence !== 'low') confidence = 'medium';
		} else {
			identificationMethod = 'set_collector';
			// High confidence for valid set + collector (if not already downgraded)
		}
	} else if (card.edition) {
		if (card.setCodeCorrected) {
			identificationMethod = 'name_set_corrected';
			// Medium confidence for corrected set codes (as per requirements)
			if (confidence !== 'low') confidence = 'medium';
		} else {
			identificationMethod = 'name_set';
			// Medium confidence for name + valid set (if not already downgraded)
		}
	} else {
		identificationMethod = 'name_only';
		confidence = 'low'; // Name only is always low
	}

	// Language mismatch handling is now done in performLanguageValidationAndSecondaryLookups
	// This function just creates the basic result structure
	return {
		originalCard: card,
		scryfallCard,
		moxfieldRow: convertCardToMoxfieldRow(card, scryfallCard),
		success: true,
		confidence,
		initialConfidence: card.initialConfidence,
		identificationMethod,
		warnings: card.warnings,
		setCodeCorrected: card.setCodeCorrected,
		sourceRowNumber: card.sourceRowNumber
	};
}

/**
 * Helper to create failed result
 */
export function createFailedResult(card: ParsedCard, errorMessage: string): ConversionResult {
	return {
		originalCard: card,
		moxfieldRow: convertCardToMoxfieldRow(card),
		success: false,
		confidence: 'low',
		initialConfidence: card.initialConfidence,
		identificationMethod: 'failed',
		error: errorMessage,
		warnings: card.warnings,
		setCodeCorrected: card.setCodeCorrected,
		sourceRowNumber: card.sourceRowNumber
	};
}

/**
 * Helper function to downgrade confidence levels
 */
export function downgradeConfidence(
	confidence: ConversionResult['confidence']
): ConversionResult['confidence'] {
	switch (confidence) {
		case 'very_high':
			return 'high';
		case 'high':
			return 'medium';
		case 'medium':
			return 'low';
		case 'low':
		default:
			return 'low'; // Can't go lower
	}
}

/**
 * CSV export utility function
 */
export function formatAsMoxfieldCSV(results: ConversionResult[]): string {
	const baseHeaders = [
		'Count',
		'Name',
		'Edition',
		'Condition',
		'Language',
		'Foil',
		'Last Modified',
		'Collector Number',
		'Alter',
		'Proxy',
		'Signed',
		'Purchase Price'
	];

	// Check if any results have warnings or errors
	const hasIssues = results.some(
		(result) => !result.success || result.error || (result.warnings && result.warnings.length > 0)
	);

	// Add Notes column if there are any issues
	const headers = hasIssues ? [...baseHeaders, 'Notes'] : baseHeaders;
	const csvLines = [headers.map((h) => `"${h}"`).join(',')];

	// Use the results in their current order (already sorted during conversion)
	// Only re-assign output row numbers if they weren't already assigned
	const needsRowNumbers = results.some((r) => !r.outputRowNumber);
	if (needsRowNumbers) {
		results.forEach((result, index) => {
			result.outputRowNumber = index + 2; // 1-based, accounting for header
		});
	}

	results.forEach((result) => {
		const row = baseHeaders.map((header) => {
			const value = result.moxfieldRow[header] || '';
			return `"${value.replace(/"/g, '""')}"`;
		});

		// Add Notes column if needed
		if (hasIssues) {
			const notes = [];
			if (!result.success || result.error) {
				notes.push(`ERROR: ${result.error || 'Conversion failed'}`);
			}
			if (result.warnings && result.warnings.length > 0) {
				notes.push(...result.warnings.map((w) => `WARNING: ${w}`));
			}
			const notesValue = notes.join('; ');
			row.push(`"${notesValue.replace(/"/g, '""')}"`);
		}

		csvLines.push(row.join(','));
	});

	return csvLines.join('\n');
}
