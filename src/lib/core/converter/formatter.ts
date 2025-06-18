import type { ConversionResult } from '../../types.js';

/**
 * Format conversion results as CSV for export
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
