import type { ParsedCard, CsvFormat, ProgressCallback } from '../../../types.js';
import type { FormatModule } from '../../formats/base.js';
import { formatAutoDetector, type FormatDetectionResult } from '../../detection/index.js';
import { parseArchidektTags } from '../validation/card-validator.js';
import { parseHelvaultExtras } from '../../formats/helvault.js';
import { parseEtchedFoil } from '../../../utils/format-helpers.js';
import { isLanguageRecognized } from '../validation/language-validator.js';
import Papa from 'papaparse';

/**
 * Preprocesses CSV content to handle special cases like separator lines.
 * Removes lines like "sep=," that some applications add at the beginning.
 */
function preprocessCSVContent(csvContent: string): string {
	const lines = csvContent.split('\n');

	// Check if the first line is a separator line (like "sep=," or '"sep=,"')
	if (lines.length > 0) {
		const firstLine = lines[0].trim();
		if (firstLine === '"sep=,"' || firstLine === 'sep=,' || firstLine.startsWith('sep=')) {
			// Remove the separator line
			return lines.slice(1).join('\n');
		}
	}

	return csvContent;
}

/**
 * Detects the CSV format from content by parsing headers.
 */
export function detectFormatFromContent(csvContent: string): FormatDetectionResult | null {
	// Preprocess content to handle separator lines like "sep=,"
	const processedContent = preprocessCSVContent(csvContent);

	// Use PapaParse to properly parse the CSV headers
	const result = Papa.parse(processedContent, {
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

/**
 * Parses CSV content into ParsedCard array using the specified format.
 */
export async function parseCSVContent(
	csvContent: string,
	formatId: string,
	progressCallback?: ProgressCallback
): Promise<ParsedCard[]> {
	if (progressCallback) progressCallback(10);

	// Preprocess content to handle separator lines like "sep=,"
	const processedContent = preprocessCSVContent(csvContent);

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
		// Use PapaParse to properly parse the CSV with error tolerance
		result = Papa.parse<Record<string, string>>(processedContent, {
			header: true,
			skipEmptyLines: true,
			delimiter: format.delimiter || ',',
			transformHeader: (header: string) => header.trim(),
			// Add tolerance for malformed CSV files
			escapeChar: '"',
			quoteChar: '"',
			// Enable error recovery for malformed quotes
			fastMode: false, // Disable fast mode for better error handling
			dynamicTyping: false // Keep all values as strings for safety
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
		// Be more tolerant of quote errors - only stop for truly critical issues
		const criticalErrors = result.errors.filter(
			(error) =>
				error.type === 'Delimiter' ||
				(error.type === 'Quotes' && error.code === 'MissingQuotes') ||
				// Only treat quote errors as critical if they affect too many rows
				(error.type === 'Quotes' &&
					result.errors.filter((e) => e.type === 'Quotes').length > result.data.length * 0.1)
		);

		if (criticalErrors.length > 0) {
			const errorMessages = criticalErrors.map(
				(error) =>
					`${error.type || error.code}: ${error.message} (Row ${error.row || 'unknown'})${error.index !== undefined ? ` at position ${error.index}` : ''}`
			);
			throw new Error(`CSV parsing failed:\n${errorMessages.join('\n')}`);
		}

		// For non-critical errors (including most quote issues), log them but continue processing
		const warningErrors = result.errors.filter((error) => !criticalErrors.includes(error));
		if (warningErrors.length > 0) {
			console.warn('Non-critical CSV parsing warnings:', warningErrors);
			// Group quote errors to provide a cleaner warning message
			const quoteErrors = warningErrors.filter((e) => e.type === 'Quotes');
			if (quoteErrors.length > 0) {
				console.warn(
					`Found ${quoteErrors.length} quote formatting issues that were automatically handled.`
				);
			}
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

/**
 * Parses a single card row into ParsedCard objects.
 * May return multiple cards for double-faced tokens.
 */
export function parseCardRow(
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

	// Process format-specific card properties
	processFormatSpecificProperties(card, format, row);

	// Add preview warnings for special cases
	addPreviewWarnings(card);

	// Check if this is a double-faced token that needs to be split
	return handleDoubleFacedTokens(card);
}

/**
 * Processes format-specific properties for a card.
 */
function processFormatSpecificProperties(
	card: ParsedCard,
	format: CsvFormat,
	row: Record<string, string>
) {
	// Parse tags for special card properties (Archidekt format)
	if (format.id === 'archidekt' && card.tags) {
		const tagParsing = parseArchidektTags(card.tags);
		card.proxy = tagParsing.proxy;
		card.signed = tagParsing.signed;
		card.alter = tagParsing.alter;
		// Clear the tags field since we don't use it in output
		card.tags = '';
	}

	// Parse extras for special card properties (Helvault format)
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
}

/**
 * Adds preview warnings for special cases.
 * These warnings appear only in the data preview, not in conversion results or exports.
 */
function addPreviewWarnings(card: ParsedCard) {
	// Warning for cards with name + collector number but no set info
	if (
		card.name &&
		card.collectorNumber &&
		!card.edition &&
		!card.editionName &&
		!card.scryfallId &&
		!card.multiverseId &&
		!card.mtgoId
	) {
		card.previewWarnings = card.previewWarnings || [];
		card.previewWarnings.push(
			'Will attempt to find correct printing using name + collector number during conversion'
		);
	}

	// Warning for unrecognized language codes - this affects conversion, so use regular warnings
	if (card.language && !isLanguageRecognized(card.language)) {
		card.warnings = card.warnings || [];
		card.warnings.push(
			`Unrecognized language code "${card.language}" - may cause conversion issues`
		);
	}
}

/**
 * Handles double-faced tokens by splitting them into separate cards if needed.
 */
function handleDoubleFacedTokens(card: ParsedCard): ParsedCard[] {
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
