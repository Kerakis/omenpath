import type { ParsedCard, ProgressCallback } from '../../../types.js';

/**
 * Simple XML parser for .dek files that works in both browser and Node.js
 * Parses MTGO .dek (XML) format files into ParsedCard array
 */

interface CardElement {
	catID: string;
	quantity: string;
	name: string;
	sideboard: string;
}

/**
 * Simple regex-based XML parser for .dek files.
 * Extracts card elements without relying on DOMParser (which isn't available in Node.js tests).
 */
function parseCardElements(xmlContent: string): CardElement[] {
	const cardElements: CardElement[] = [];
	// Match <Cards CatID="..." Quantity="..." Sideboard="..." Name="..." ... />
	const cardRegex =
		/<Cards\s+[^>]*?CatID="([^"]+)"[^>]*?Quantity="([^"]+)"[^>]*?Sideboard="([^"]+)"[^>]*?Name="([^"]+)"[^>]*?\/>/g;

	let match;
	while ((match = cardRegex.exec(xmlContent)) !== null) {
		cardElements.push({
			catID: match[1],
			quantity: match[2],
			sideboard: match[3],
			name: match[4]
		});
	}

	// If the first regex didn't find anything, try with different attribute orders
	if (cardElements.length === 0) {
		// More flexible regex that handles attributes in any order
		const flexibleRegex = /<Cards\s+([^>]*?\/)?>/g;
		let flexMatch;
		while ((flexMatch = flexibleRegex.exec(xmlContent)) !== null) {
			const attrString = flexMatch[1] || '';

			// Extract each attribute
			const catIDMatch = /CatID="([^"]+)"/.exec(attrString);
			const quantityMatch = /Quantity="([^"]+)"/.exec(attrString);
			const sideboardMatch = /Sideboard="([^"]+)"/.exec(attrString);
			const nameMatch = /Name="([^"]+)"/.exec(attrString);

			if (catIDMatch && quantityMatch && sideboardMatch && nameMatch) {
				cardElements.push({
					catID: catIDMatch[1],
					quantity: quantityMatch[1],
					sideboard: sideboardMatch[1],
					name: nameMatch[1]
				});
			}
		}
	}

	return cardElements;
}

/**
 * Parses MTGO .dek (XML) format files into ParsedCard array
 * The .dek format is XML with card entries like:
 * <Cards CatID="79038" Quantity="1" Sideboard="false" Name="Reaper King" />
 */
export async function parseDekContent(
	dekContent: string,
	progressCallback?: ProgressCallback
): Promise<ParsedCard[]> {
	if (progressCallback) progressCallback(10);

	try {
		// Validate XML structure
		if (!dekContent.trim().startsWith('<?xml')) {
			throw new Error('Not a valid DEK file (missing XML declaration)');
		}

		// Parse card elements using regex
		const cardElements = parseCardElements(dekContent);

		if (cardElements.length === 0) {
			throw new Error('.dek file contains no card entries');
		}

		if (progressCallback) progressCallback(20);

		const cards: ParsedCard[] = [];

		// Parse each card element
		cardElements.forEach((element, index) => {
			if (progressCallback && index % 100 === 0) {
				const progress = 20 + (index / cardElements.length) * 60;
				progressCallback(progress);
			}

			const { catID, quantity, name, sideboard } = element;

			// Skip sideboard cards - only main deck cards are imported
			if (sideboard === 'true') {
				return;
			}

			// Skip if critical fields are missing
			if (!name || !catID || !quantity) {
				console.warn(
					`Skipping card with missing data: Name=${name}, CatID=${catID}, Quantity=${quantity}`
				);
				return;
			}

			const count = parseInt(quantity, 10);
			if (isNaN(count) || count <= 0) {
				console.warn(`Skipping card with invalid quantity: ${name} (${quantity})`);
				return;
			}

			const card: ParsedCard = {
				originalData: {
					name: name,
					catID: catID,
					quantity: quantity,
					sideboard: sideboard || 'false'
				},
				count: count,
				name: name.trim(),
				mtgoId: parseInt(catID, 10),
				// For MTGO, we'll use mtgoId as primary identifier
				needsLookup: true, // Will need Scryfall lookup to get other identifiers
				initialConfidence: 'high' // MTGO catID is a reliable identifier
			};

			cards.push(card);
		});

		if (progressCallback) progressCallback(90);

		if (cards.length === 0) {
			throw new Error('No valid cards found in .dek file (all cards may have been sideboards)');
		}

		if (progressCallback) progressCallback(100);

		return cards;
	} catch (error) {
		throw new Error(
			`Failed to parse .dek file: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Detects if content is a .dek file by checking for XML declaration and Deck root element
 */
export function isDekFormat(content: string): boolean {
	// Check for XML declaration
	if (!content.trim().startsWith('<?xml')) {
		return false;
	}

	// Try to find the Deck root element
	return /<Deck\s+xmlns:xsd=/.test(content) || /<Deck>/.test(content);
}
