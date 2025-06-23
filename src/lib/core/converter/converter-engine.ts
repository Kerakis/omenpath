import type {
	ConverterEngine,
	ParsedCard,
	ConversionResult,
	CsvFormat,
	ApiHealthResult,
	SetValidationResult,
	ProgressCallback,
	ExportOptions
} from '../../types.js';
import { formatAutoDetector, type FormatDetectionResult } from '../detection/index.js';
import type { FormatModule } from '../formats/base.js';
import {
	checkScryfallApiHealth,
	validateSetCode,
	findSetCodeByName
} from '../../utils/scryfall-utils.js';
import { isLanguageRecognized } from './api/language-validator.js';
import { parseArchidektTags } from './validation/card-validator.js';
import { parseHelvaultExtras } from '../formats/helvault.js';
import { parseEtchedFoil } from '../../utils/format-helpers.js';
import { formatAsMoxfieldCSV, createSuccessfulResult } from './result-formatter.js';
import { performNameAndCollectorNumberLookups } from './strategies/name-collector-lookup.js';
import { performPrimaryLookups } from './strategies/primary-lookup.js';
import { performLanguageValidationAndSecondaryLookups } from './strategies/secondary-lookup.js';
import Papa from 'papaparse';

// Create main converter engine
export function createConverterEngine(): ConverterEngine {
	return {
		// Get all supported formats from the auto-detector
		getSupportedFormats: () => {
			return formatAutoDetector.getAllFormats();
		},

		// Auto-detect format from CSV headers
		detectFormat: (headers: string[]) => {
			const detection = formatAutoDetector.detectFormat(headers);
			return detection?.format.id || null;
		},

		// Parse file into ParsedCard array
		parseFile: async (
			file: File,
			format: string,
			progressCallback?: ProgressCallback
		): Promise<ParsedCard[]> => {
			const content = await file.text();
			return parseCSVContent(content, format, progressCallback);
		},

		// Convert file to Moxfield format using the new 3-step process
		convertFile: async (
			file: File,
			format: string,
			progressCallback?: ProgressCallback,
			defaultCondition?: string,
			exportOptions?: ExportOptions
		): Promise<ConversionResult[]> => {
			if (progressCallback) progressCallback(0);

			// Step 0: Parse CSV content
			const content = await file.text();
			const parsedCards = await parseCSVContent(content, format, progressCallback);

			return convertParsedCards(parsedCards, progressCallback, defaultCondition, exportOptions);
		},

		// Convert pre-validated cards (used when cards have already been parsed and validated)
		convertPrevalidatedCards: async (
			validatedCards: ParsedCard[],
			progressCallback?: ProgressCallback,
			defaultCondition?: string,
			exportOptions?: ExportOptions
		): Promise<ConversionResult[]> => {
			return convertParsedCards(validatedCards, progressCallback, defaultCondition, exportOptions);
		},

		// Check API health
		checkApiHealth: async (): Promise<ApiHealthResult> => {
			return await checkScryfallApiHealth();
		},

		// Validate set codes in parsed cards (called after parsing, before conversion)
		validateSetCodes: async (cards: ParsedCard[]): Promise<SetValidationResult> => {
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
			const setCodes = [
				...new Set(cardsNeedingValidation.map((card) => card.edition).filter(Boolean))
			];

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
					const cardsWithThisSet = cardsNeedingValidation.filter(
						(card) => card.edition === setCode
					);
					const setNames = [
						...new Set(cardsWithThisSet.map((card) => card.editionName).filter(Boolean))
					];
					let bestCorrection: { code: string; confidence: number; matchedName?: string } | null =
						null;

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
	};
}

// Helper function to apply set corrections to a card
function applySetCorrections(
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

// Helper function to determine if a card needs token prefix
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

// Helper function to assign initial confidence levels
function assignInitialConfidence(card: ParsedCard) {
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

// Common conversion logic used by both convertFile and convertPrevalidatedCards
async function convertParsedCards(
	parsedCards: ParsedCard[],
	progressCallback?: ProgressCallback,
	defaultCondition?: string,
	exportOptions?: ExportOptions
): Promise<ConversionResult[]> {
	// Ensure all cards have confidence levels (fallback if missing)
	for (const card of parsedCards) {
		if (!card.initialConfidence) {
			assignInitialConfidence(card);
		}
	}

	if (progressCallback) progressCallback(20);

	// Step 1: Handle special case of name + collector number (no set)
	const { processedCards, nameOnlyCards } = await performNameAndCollectorNumberLookups(parsedCards);

	// Create results for cards that were successfully found via search
	const searchResults: ConversionResult[] = [];
	for (const card of processedCards) {
		if (card.foundViaNameCollectorSearch && card.scryfallCardData) {
			// Use the stored Scryfall card data directly - no need for additional API calls
			searchResults.push(
				createSuccessfulResult(card, card.scryfallCardData, defaultCondition, exportOptions)
			);
		} else {
			// Card without stored data should go to primary lookup
			nameOnlyCards.push(card);
		}
	}

	// Only send nameOnlyCards (fallback cases) to the collection endpoint
	const allCardsForPrimaryLookup = nameOnlyCards;

	if (progressCallback) progressCallback(30);

	// Step 2: Perform primary lookups (set validation should have happened before conversion)
	const primaryResults = await performPrimaryLookups(
		allCardsForPrimaryLookup,
		progressCallback,
		defaultCondition,
		exportOptions
	);

	if (progressCallback) progressCallback(80);

	// Step 3: Language validation and secondary lookups
	const finalResults = await performLanguageValidationAndSecondaryLookups(
		primaryResults,
		defaultCondition,
		progressCallback,
		exportOptions
	);

	// Combine search results with final results
	const allResults = [...searchResults, ...finalResults];

	// Sort results and assign output row numbers for preview display
	// Sort: errors first, then warnings, then successful entries
	const sortedResults = [...allResults].sort((a, b) => {
		// Priority: errors (0), warnings (1), success (2)
		const aPriority = !a.success || a.error ? 0 : a.warnings && a.warnings.length > 0 ? 1 : 2;
		const bPriority = !b.success || b.error ? 0 : b.warnings && b.warnings.length > 0 ? 1 : 2;

		if (aPriority !== bPriority) {
			return aPriority - bPriority;
		}

		// Within same priority, sort alphabetically by name
		const aName = a.moxfieldRow.Name || '';
		const bName = b.moxfieldRow.Name || '';
		return aName.localeCompare(bName);
	});

	// Assign output row numbers (1-based, accounting for header)
	sortedResults.forEach((result, index) => {
		result.outputRowNumber = index + 2;
	});

	if (progressCallback) progressCallback(100);
	return sortedResults;
}

// Helper function to detect format from CSV content
export function detectFormatFromContent(csvContent: string): FormatDetectionResult | null {
	// Use PapaParse to properly parse the CSV headers
	const result = Papa.parse(csvContent, {
		header: false,
		skipEmptyLines: true,
		preview: 1 // Only parse the first row to get headers
	});

	if (result.errors.length > 0) {
		console.warn('CSV parsing errors:', result.errors);
	}

	if (result.data.length === 0) return null;

	// Get headers from first row
	const headers = (result.data[0] as string[]).map((h) => h.trim());

	return formatAutoDetector.detectFormat(headers);
}

// Helper function to parse CSV content
async function parseCSVContent(
	csvContent: string,
	formatId: string,
	progressCallback?: ProgressCallback
): Promise<ParsedCard[]> {
	if (progressCallback) progressCallback(10);

	// Find format
	const allFormats = formatAutoDetector.getAllFormats();
	const format = allFormats.find((f) => f.id === formatId);
	if (!format) {
		throw new Error(`Unknown format: ${formatId}`);
	}

	// Get the format module for custom parsing if available
	const formatModule = formatAutoDetector.getFormatModule(formatId);

	let result: Papa.ParseResult<Record<string, string>>;

	try {
		// Use PapaParse to properly parse the CSV
		result = Papa.parse(csvContent, {
			header: true,
			skipEmptyLines: true,
			delimiter: format.delimiter || ',',
			transformHeader: (header: string) => header.trim()
		});
	} catch (error) {
		throw new Error(
			`Failed to parse CSV file: ${error instanceof Error ? error.message : String(error)}`
		);
	}

	// Handle PapaParse errors
	if (result.errors.length > 0) {
		console.warn('CSV parsing errors:', result.errors);

		// Check for critical errors that should stop processing
		const criticalErrors = result.errors.filter(
			(error) =>
				error.type === 'Delimiter' || error.type === 'Quotes' || error.code === 'MissingQuotes'
		);

		if (criticalErrors.length > 0) {
			const errorMessages = criticalErrors.map(
				(error) =>
					`${error.type || error.code}: ${error.message} (Row ${error.row || 'unknown'})${error.index !== undefined ? ` at position ${error.index}` : ''}`
			);
			throw new Error(`CSV parsing failed:\n${errorMessages.join('\n')}`);
		}

		// For non-critical errors, log them but continue processing
		const warningErrors = result.errors.filter((error) => !criticalErrors.includes(error));
		if (warningErrors.length > 0) {
			console.warn('Non-critical CSV parsing warnings:', warningErrors);
		}
	}

	if (!result.data || result.data.length === 0) {
		throw new Error('CSV file is empty or contains no valid data rows');
	}

	if (progressCallback) progressCallback(20);

	// Parse data rows
	const cards: ParsedCard[] = [];
	const rows = result.data as Record<string, string>[];
	for (let i = 0; i < rows.length; i++) {
		if (progressCallback && i % 100 === 0) {
			const progress = 20 + (i / rows.length) * 60;
			progressCallback(progress);
		}

		const row = rows[i];
		if (!row || Object.keys(row).length === 0) continue;

		try {
			const parsedCards = parseCardRow(row, format, formatModule, i + 2); // Row number is i + 2 (1-based, accounting for header)
			if (parsedCards && parsedCards.length > 0) {
				cards.push(...parsedCards);
			}
		} catch (error) {
			console.warn(`Error parsing row ${i + 2}:`, error);
		}
	}
	return cards;
}

// Helper function to parse a single card row (may return multiple cards for double-faced tokens)
function parseCardRow(
	row: Record<string, string>,
	format: CsvFormat,
	formatModule: FormatModule | null,
	rowNumber: number
): ParsedCard[] {
	// Create base card object
	const card: ParsedCard = {
		originalData: row,
		count: 1,
		name: '',
		edition: '',
		condition: 'Near Mint',
		language: 'English',
		foil: '',
		collectorNumber: '',
		scryfallId: '',
		multiverseId: undefined,
		mtgoId: undefined,
		purchasePrice: '',
		needsLookup: true,
		conversionStatus: 'pending',
		sourceRowNumber: rowNumber
	};

	// Use custom parseRow function if available, otherwise use standard column mappings
	let parsedData: Record<string, string>;
	if (formatModule?.parseRow) {
		parsedData = formatModule.parseRow(row, format);
	} else {
		// Apply standard column mappings
		parsedData = {};
		for (const [cardField, columnName] of Object.entries(format.columnMappings)) {
			if (columnName && row[columnName] !== undefined) {
				let value = row[columnName];

				// Apply transformations if they exist
				if (format.transformations && format.transformations[cardField]) {
					value = format.transformations[cardField](value);
				}

				parsedData[cardField] = value;
			}
		}
	}

	// Apply parsed data to card object
	for (const [cardField, value] of Object.entries(parsedData)) {
		if (cardField === 'count') {
			card.count = parseInt(value) || 1;
		} else if (cardField === 'multiverseId') {
			card.multiverseId = value ? parseInt(value) : undefined;
		} else if (cardField === 'mtgoId') {
			card.mtgoId = value ? parseInt(value) : undefined;
		} else if (cardField === 'warnings') {
			// Handle warnings specially - they can come from parsing
			card.warnings = card.warnings || [];
			card.warnings.push(value);
		} else {
			// Use type assertion for dynamic property assignment
			// This handles all fields including custom ones like specialSearchQuery
			(card as Record<string, string | number | undefined>)[cardField] = value;
		}
	}

	// Don't exclude cards based on missing name - all entries should be shown in preview
	// Cards with insufficient data will get appropriate warnings and fail during conversion
	// Parse tags for special card properties (Archidekt format)
	if (format.id === 'archidekt' && card.tags) {
		const tagParsing = parseArchidektTags(card.tags);
		card.proxy = tagParsing.proxy;
		card.signed = tagParsing.signed;
		card.alter = tagParsing.alter;
		// Clear the tags field since we don't use it in output
		card.tags = '';
	} // Parse extras for special card properties (Helvault format)
	if (format.id === 'helvault' && card.extras) {
		const extrasParsing = parseHelvaultExtras(card.extras as string);
		card.foil = extrasParsing.foil;
		card.proxy = extrasParsing.proxy;
		card.signed = extrasParsing.signed;
		card.alter = extrasParsing.alter;
		// Clear the extras field since we don't use it in output
		card.extras = '';
	}

	// Process CardCastle JSON ID (fix DFC trailing 0 issue)
	if (format.id === 'cardcastle-full' && card.jsonId) {
		const jsonId = card.jsonId as string;
		// Handle dual-faced card issue - remove trailing 0 if present and length suggests it
		if (jsonId.length > 36 && jsonId.endsWith('0')) {
			card.scryfallId = jsonId.slice(0, -1);
		} else {
			card.scryfallId = jsonId;
		}
		// Clear the jsonId field since we've converted it to scryfallId
		card.jsonId = '';
	}

	// Add preview warnings for special cases
	if (
		card.name &&
		card.collectorNumber &&
		!card.edition &&
		!card.editionName &&
		!card.scryfallId &&
		!card.multiverseId &&
		!card.mtgoId
	) {
		// Card has name + collector number but no set info or other identifiers - will attempt special lookup
		card.warnings = card.warnings || [];
		card.warnings.push(
			'Will attempt to find correct printing using name + collector number during conversion'
		);
	}

	// Add warning for unrecognized language codes
	if (card.language && !isLanguageRecognized(card.language)) {
		card.warnings = card.warnings || [];
		card.warnings.push(
			`Unrecognized language code "${card.language}" - may cause conversion issues`
		);
	}

	// Parse etched foil information for all formats
	const etchedResult = parseEtchedFoil(format.id, row, card.edition, card.editionName);
	if (etchedResult.isEtched) {
		card.isEtched = true;

		// Update set information if it was cleaned
		if (etchedResult.cleanedSetCode && etchedResult.cleanedSetCode !== card.edition) {
			card.edition = etchedResult.cleanedSetCode;
		}
		if (etchedResult.cleanedSetName && etchedResult.cleanedSetName !== card.editionName) {
			card.editionName = etchedResult.cleanedSetName;
		}

		// Add warnings if any were generated
		if (etchedResult.warnings && etchedResult.warnings.length > 0) {
			card.warnings = card.warnings || [];
			card.warnings.push(...etchedResult.warnings);
		}
	}

	// Check if this is a double-faced token that needs to be split
	const cardAsRecord = card as Record<string, unknown>;
	if (cardAsRecord.isDoubleFacedToken === 'true' && cardAsRecord.doubleFacedTokenFaces) {
		try {
			const faces = JSON.parse(cardAsRecord.doubleFacedTokenFaces as string) as Array<{
				name: string;
				collectorNumber?: string;
			}>;

			// Create separate cards for each face
			const cards: ParsedCard[] = [];
			faces.forEach((face, index) => {
				const faceCard: ParsedCard = { ...card };
				faceCard.name = face.name;
				if (face.collectorNumber) {
					faceCard.collectorNumber = face.collectorNumber;
				}
				// Add warnings about double-faced token handling (only add face-specific info)
				faceCard.warnings = [...(card.warnings || [])]; // Copy original warnings
				faceCard.warnings.push(`Face ${index + 1} of ${faces.length}: ${face.name}`);
				cards.push(faceCard);
			});

			return cards;
		} catch (error) {
			console.warn('Failed to parse double-faced token faces:', error);
			// Fall back to single card
		}
	}

	return [card];
}

// Re-export the formatAsMoxfieldCSV function
export { formatAsMoxfieldCSV };
