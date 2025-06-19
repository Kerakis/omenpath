import type { ParsedCard, ScryfallCard, ConversionResult, ExportOptions } from '../../types.js';
import { getLanguageDisplayName } from './api/language-validator.js';

/**
 * Helper function to convert ParsedCard to Moxfield row format
 */
function convertCardToMoxfieldRow(
	card: ParsedCard,
	scryfallCard?: ScryfallCard,
	defaultCondition?: string,
	exportOptions?: ExportOptions
): Record<string, string> {
	// If we have Scryfall data, use it to fill in missing information
	const edition = card.edition || scryfallCard?.set || '';
	const collectorNumber = card.collectorNumber || scryfallCard?.collector_number || '';
	const name = card.name || scryfallCard?.name || '';

	// Use the actual language from Scryfall if available, otherwise fall back to original
	const language = scryfallCard?.lang
		? getLanguageDisplayName(scryfallCard.lang)
		: card.language || 'English';

	// Handle foil and etched foil for Moxfield format
	let foilValue = '';
	if (card.isEtched) {
		foilValue = 'etched';
	} else if (card.foil) {
		// Normalize various foil representations to Moxfield format
		const foilLower = card.foil.toLowerCase();
		if (foilLower === 'foil' || foilLower === 'f' || foilLower === 'yes' || foilLower === 'true') {
			foilValue = 'foil';
		} else if (foilLower === 'etched' || foilLower === 'etch') {
			foilValue = 'etched';
		} else if (
			foilLower === 'normal' ||
			foilLower === 'n' ||
			foilLower === 'no' ||
			foilLower === 'false' ||
			foilLower === ''
		) {
			foilValue = '';
		} else {
			// Pass through other values as-is for now
			foilValue = card.foil;
		}
	}

	const baseRow: Record<string, string> = {
		Count: card.count.toString(),
		'Tradelist Count': '', // Empty for now, could be filled if we track trading
		Name: name,
		Edition: edition,
		Condition: card.condition || defaultCondition || 'Near Mint',
		Language: language,
		Foil: foilValue,
		Tags: card.tags || '',
		'Last Modified': card.lastModified || '',
		'Collector Number': collectorNumber,
		Alter: card.alter || 'FALSE',
		Proxy: card.proxy || 'FALSE',
		Signed: card.signed || 'FALSE',
		'Purchase Price': card.purchasePrice || '',
		'Scryfall ID': scryfallCard?.id || card.scryfallId || ''
	};

	// Add optional export fields if requested
	if (exportOptions) {
		console.log('Export options received:', exportOptions);

		if (exportOptions.includeCurrentPrice) {
			const priceField = `Current Price (${exportOptions.priceType.toUpperCase()})`;
			const priceValue =
				getPriceFromScryfallCard(scryfallCard, exportOptions.priceType, card.foil) || '';
			baseRow[priceField] = priceValue;
			console.log(`Added price field: ${priceField} = ${priceValue}`);
		}

		if (exportOptions.includeMtgoIds) {
			baseRow['MTGO ID'] = scryfallCard?.mtgo_id?.toString() || card.mtgoId?.toString() || '';
			console.log(`Added MTGO ID: ${baseRow['MTGO ID']}`);
		}

		if (exportOptions.includeMultiverseId) {
			baseRow['Multiverse ID'] =
				scryfallCard?.multiverse_ids?.[0]?.toString() || card.multiverseId?.toString() || '';
			console.log(`Added Multiverse ID: ${baseRow['Multiverse ID']}`);
		}

		if (exportOptions.includeTcgPlayerId) {
			baseRow['TCGPlayer ID'] = scryfallCard?.tcgplayer_id?.toString() || '';
			console.log(`Added TCGPlayer ID: ${baseRow['TCGPlayer ID']}`);
		}

		if (exportOptions.includeCardMarketId) {
			baseRow['CardMarket ID'] = scryfallCard?.cardmarket_id?.toString() || '';
			console.log(`Added CardMarket ID: ${baseRow['CardMarket ID']}`);
		}
	} else {
		console.log('No export options provided');
	}

	return baseRow;
}

/**
 * Helper function to get price from Scryfall card based on currency and foil status
 */
function getPriceFromScryfallCard(
	scryfallCard: ScryfallCard | undefined,
	priceType: 'usd' | 'eur' | 'tix',
	foil?: string
): string | undefined {
	if (!scryfallCard?.prices) return undefined;

	const isFoil = foil?.toLowerCase() === 'foil';
	const prices = scryfallCard.prices;

	switch (priceType) {
		case 'usd':
			return isFoil ? prices.usd_foil : prices.usd;
		case 'eur':
			return isFoil ? prices.eur_foil : prices.eur;
		case 'tix':
			return prices.tix; // MTGO tickets don't have foil variants
		default:
			return undefined;
	}
}

/**
 * Helper to create successful result
 */
export function createSuccessfulResult(
	card: ParsedCard,
	scryfallCard: ScryfallCard,
	defaultCondition?: string,
	exportOptions?: ExportOptions
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
		moxfieldRow: convertCardToMoxfieldRow(card, scryfallCard, defaultCondition, exportOptions),
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
	// Get all unique column names from the moxfieldRow data dynamically
	const allColumns = new Set<string>();
	results.forEach((result) => {
		if (result.moxfieldRow) {
			Object.keys(result.moxfieldRow).forEach((key) => allColumns.add(key));
		}
	});

	// Define the core columns in preferred order
	const coreColumns = [
		'Count',
		'Tradelist Count',
		'Name',
		'Edition',
		'Condition',
		'Language',
		'Foil',
		'Tags',
		'Last Modified',
		'Collector Number',
		'Alter',
		'Proxy',
		'Signed',
		'Purchase Price',
		'Scryfall ID'
	];

	// Get additional export columns (prices, IDs, etc.) that aren't in core columns
	const exportColumns = Array.from(allColumns).filter((col) => !coreColumns.includes(col));

	// Combine core columns with export columns, only including columns that exist in the data
	const headers = [...coreColumns.filter((col) => allColumns.has(col)), ...exportColumns];

	// Check if any results have warnings or errors
	const hasIssues = results.some(
		(result) => !result.success || result.error || (result.warnings && result.warnings.length > 0)
	);

	// Add Notes column if there are any issues
	const finalHeaders = hasIssues ? [...headers, 'Notes'] : headers;
	const csvLines = [finalHeaders.map((h) => `"${h}"`).join(',')];

	// Use the results in their current order (already sorted during conversion)
	// Only re-assign output row numbers if they weren't already assigned
	const needsRowNumbers = results.some((r) => !r.outputRowNumber);
	if (needsRowNumbers) {
		results.forEach((result, index) => {
			result.outputRowNumber = index + 2; // 1-based, accounting for header
		});
	}

	results.forEach((result) => {
		const row = headers.map((header) => {
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

/**
 * Dynamically regenerate moxfieldRow for a conversion result based on current export options
 */
export function regenerateMoxfieldRow(
	result: ConversionResult,
	exportOptions: ExportOptions,
	defaultCondition?: string
): Record<string, string> {
	return convertCardToMoxfieldRow(
		result.originalCard,
		result.scryfallCard,
		defaultCondition,
		exportOptions
	);
}
