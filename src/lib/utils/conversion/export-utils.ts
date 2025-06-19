import type { ConversionResult } from '../../types.js';
import type { ConversionResultFile } from './stats-calculator.js';
import { formatAsMoxfieldCSV } from '../../core/converter/result-formatter.js';

/**
 * Get original CSV line from card data
 */
export function getOriginalCsvLine(card: ConversionResult): string {
	if (!card.originalCard?.originalData) return '';

	// Try to reconstruct the original CSV line from the parsed data
	const data = card.originalCard.originalData;
	const values = Object.values(data).map((value: unknown) => {
		// Handle values that might contain commas by wrapping in quotes
		const str = String(value || '');
		if (str.includes(',') || str.includes('"') || str.includes('\n')) {
			return `"${str.replace(/"/g, '""')}"`;
		}
		return str;
	});
	return values.join(',');
}

/**
 * Download CSV file
 */
export function downloadCSV(result: ConversionResultFile) {
	if (!result.data || !result.success) return;

	// Export as CSV
	const csvContent = formatAsMoxfieldCSV(result.data);
	const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
	const link = document.createElement('a');

	const url = URL.createObjectURL(blob);
	link.setAttribute('href', url);
	link.setAttribute('download', 'cards.csv');
	link.style.visibility = 'hidden';

	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

/**
 * Download TXT file for MTG Arena/deck format
 */
export function downloadTXT(result: ConversionResultFile) {
	if (!result.data || !result.success) return;
	// Sort results: errors first, then warnings, then successful entries
	const sortedResults = [...result.data].sort((a: ConversionResult, b: ConversionResult) => {
		// Priority: errors (0), warnings (1), success (2)
		const aPriority = !a.success || a.error ? 0 : a.warnings && a.warnings.length > 0 ? 1 : 2;
		const bPriority = !b.success || b.error ? 0 : b.warnings && b.warnings.length > 0 ? 1 : 2;

		if (aPriority !== bPriority) {
			return aPriority - bPriority;
		}

		// Within same priority, sort alphabetically by name
		const aName = a.moxfieldRow?.Name || '';
		const bName = b.moxfieldRow?.Name || '';
		return aName.localeCompare(bName);
	});

	// Track output row numbers
	sortedResults.forEach((result, index) => {
		result.outputRowNumber = index + 1; // 1-based for TXT format
	});

	const txtContent = sortedResults
		.map((r: ConversionResult) => {
			if (r.success) {
				// Successful card conversion - use Moxfield format
				const count = r.moxfieldRow.Count || '1';
				const name = r.moxfieldRow.Name || '';
				const setCode = r.moxfieldRow.Edition ? `(${r.moxfieldRow.Edition})` : '';
				const collectorNumber = r.moxfieldRow['Collector Number'] || '';

				// Handle foil types correctly for Moxfield format
				let foilSuffix = '';
				const foilValue = r.moxfieldRow.Foil?.toLowerCase();
				if (foilValue === 'foil' || foilValue === 'true' || foilValue === '1') {
					foilSuffix = ' *F*';
				} else if (foilValue === 'etched') {
					foilSuffix = ' *E*';
				}

				// Format: {count} {name} ({set-code}) {collector-number} {foil}
				let line = `${count} ${name}`;
				if (setCode) {
					line += ` ${setCode}`;
				}
				if (collectorNumber) {
					line += ` ${collectorNumber}`;
				}
				if (foilSuffix) {
					line += foilSuffix;
				}

				// Add comments for warnings/errors
				const comments = [];
				if (r.warnings && r.warnings.length > 0) {
					comments.push(...r.warnings.map((w: string) => `WARNING: ${w}`));
				}

				if (comments.length > 0) {
					line += ` // ${comments.join('; ')}`;
				}

				return line;
			} else {
				// Failed card - include as comment so user knows it was there
				const count = r.originalCard.count || 1;
				const name = r.originalCard.name || 'Unknown Card';
				const setCode = r.originalCard.edition ? `(${r.originalCard.edition})` : '';
				const collectorNumber = r.originalCard.collectorNumber || '';
				const foil = r.originalCard.foil || '';

				let line = `# FAILED: ${count} ${name}`;
				if (setCode) {
					line += ` ${setCode}`;
				}
				if (collectorNumber) {
					line += ` ${collectorNumber}`;
				}
				if (foil) {
					line += ` [${foil}]`;
				}
				line += ` - Error: ${r.error || 'Unknown error'}`;

				return line;
			}
		})
		.join('\n');

	const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
	const link = document.createElement('a');

	const url = URL.createObjectURL(blob);
	link.setAttribute('href', url);
	link.setAttribute('download', 'cards.txt');
	link.style.visibility = 'hidden';

	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}
