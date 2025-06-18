import type { CsvFormat } from '../../types.js';

export interface FormatDetectionResult {
	format: CsvFormat;
	confidence: number;
	matchingHeaders: string[];
}

export interface FormatModule {
	format: CsvFormat;
	detectFormat: (headers: string[]) => number; // Returns confidence score 0-1
	parseRow?: (row: Record<string, string>, format: CsvFormat) => Record<string, string>;
}

export interface AutoDetector {
	detectFormat: (headers: string[]) => FormatDetectionResult | null;
	getAllFormats: () => CsvFormat[];
}
