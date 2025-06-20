import type { ConversionResult } from '../../types.js';

// Result structure for conversion results
export interface ConversionResultFile {
	filename: string;
	success: boolean;
	data?: ConversionResult[];
	error?: string;
}

/**
 * Calculate basic statistics from conversion results
 */
export function getStats(result: ConversionResultFile) {
	if (!result.data) return { totalEntries: 0, totalCards: 0, successful: 0, failed: 0 };

	const totalEntries = result.data.length;
	const totalCards = result.data.reduce(
		(sum: number, r: ConversionResult) =>
			sum + (parseInt(r.originalCard?.count?.toString() || '1') || 1),
		0
	);
	const successful = result.data.filter((r: ConversionResult) => r.success).length;
	const failed = totalEntries - successful;

	return { totalEntries, totalCards, successful, failed };
}

/**
 * Calculate confidence level statistics
 */
export function getConfidenceStats(result: ConversionResultFile) {
	if (!result.data) return { veryHigh: 0, high: 0, medium: 0, low: 0, error: 0, uncertain: 0 };

	const successful = result.data.filter((r: ConversionResult) => r.success);
	const failed = result.data.filter((r: ConversionResult) => !r.success);
	const veryHigh = successful.filter((r: ConversionResult) => r.confidence === 'very_high').length;
	const high = successful.filter((r: ConversionResult) => r.confidence === 'high').length;
	const medium = successful.filter((r: ConversionResult) => r.confidence === 'medium').length;
	const low = successful.filter((r: ConversionResult) => r.confidence === 'low').length;
	const error = failed.length;
	const uncertain = medium + low + error; // Cards that might need review (includes errors)

	return { veryHigh, high, medium, low, error, uncertain };
}

/**
 * Get identification methods used
 */
export function getIdentificationMethods(result: ConversionResultFile) {
	if (!result.data) return {};

	// Count identification methods for all results, not just successful ones
	const methods: Record<string, number> = {};

	result.data.forEach((r: ConversionResult) => {
		const method = r.identificationMethod || 'unknown';
		methods[method] = (methods[method] || 0) + 1;
	});

	return methods;
}

/**
 * Get failed cards from results
 */
export function getFailedCards(result: ConversionResultFile) {
	if (!result.data) return [];
	return result.data.filter((r: ConversionResult) => !r.success);
}

/**
 * Get method display label
 */
export function getMethodLabel(method: string): string {
	const labels: Record<string, string> = {
		scryfall_id: 'Scryfall ID',
		multiverse_id: 'Multiverse ID',
		mtgo_id: 'MTGO ID',
		set_collector: 'Set + Collector #',
		set_collector_corrected: 'Set + Collector # (Set Corrected)',
		name_set: 'Name + Set',
		name_set_corrected: 'Name + Set (Set Corrected)',
		name_collector: 'Name + Collector #',
		name_only: 'Name Only',
		special_case: 'Special Case',
		failed: 'Failed'
	};

	return labels[method] || method;
}

/**
 * Sort results for display (low confidence first, then alphabetically)
 */
export function getSortedResults(result: ConversionResultFile) {
	if (!result.data) return [];

	// Sort results: low confidence first, then by name alphabetically
	return [...result.data].sort((a: ConversionResult, b: ConversionResult) => {
		// First sort by confidence (errors and low confidence first)
		const confidenceOrder: Record<string, number> = {
			error: -1, // Failed cards first
			low: 0,
			medium: 1,
			high: 2,
			very_high: 3
		};
		const aConfidence = a.success ? (confidenceOrder[a.confidence as string] ?? 2) : -1;
		const bConfidence = b.success ? (confidenceOrder[b.confidence as string] ?? 2) : -1;

		if (aConfidence !== bConfidence) {
			return aConfidence - bConfidence;
		}

		// Then sort alphabetically by name
		const aName = a.moxfieldRow?.Name || '';
		const bName = b.moxfieldRow?.Name || '';
		return aName.localeCompare(bName);
	});
}

/**
 * Helper function for proper pluralization
 */
export function pluralize(count: number, singular: string, plural?: string): string {
	if (count === 1) return `${count} ${singular}`;
	return `${count} ${plural || singular + 's'}`;
}

/**
 * Format confidence display
 */
export function formatConfidence(card: ConversionResult): string {
	if (!card.success) {
		return 'Error';
	}

	switch (card.confidence) {
		case 'very_high':
			return 'Very High';
		case 'high':
			return 'High';
		case 'medium':
			return 'Medium';
		case 'low':
			return 'Low';
		default:
			return 'Unknown';
	}
}
