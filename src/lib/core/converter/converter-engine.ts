import type {
	ConverterEngine,
	ParsedCard,
	ConversionResult,
	ApiHealthResult,
	SetValidationResult,
	ProgressCallback,
	ExportOptions
} from '../../types.js';
import { formatAutoDetector } from '../detection/index.js';
import { checkScryfallApiHealth } from '../../utils/scryfall-utils.js';
import { formatAsMoxfieldCSV } from './result-formatter.js';
import { validateSetCodes } from './validation/set-validator.js';
import { parseCSVContent } from './parsing/csv-parser.js';
import { convertParsedCards } from './orchestration/conversion-orchestrator.js';

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

		// Convert file to Moxfield format
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
			return await validateSetCodes(cards);
		}
	};
}

// Re-export functions from extracted modules
export { formatAsMoxfieldCSV };
export { detectFormatFromContent } from './parsing/csv-parser.js';
