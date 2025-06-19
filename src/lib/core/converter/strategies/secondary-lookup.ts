import type { ParsedCard, ConversionResult, ProgressCallback } from '../../../types.js';
import { validateLanguageMatch, getScryfallLanguageCode } from '../api/language-validator.js';
import { fetchScryfallCardByLanguage, applyRateLimit } from '../api/scryfall-api.js';
import { createSuccessfulResult, downgradeConfidence } from '../result-formatter.js';

/**
 * Step 3: Language validation and secondary lookups
 */
export async function performLanguageValidationAndSecondaryLookups(
	primaryResults: Array<{ card: ParsedCard; result?: ConversionResult; needsRetry?: boolean }>,
	defaultCondition?: string,
	progressCallback?: ProgressCallback
): Promise<ConversionResult[]> {
	const finalResults: ConversionResult[] = [];
	let processed = 0;
	const total = primaryResults.length;

	for (const primaryResult of primaryResults) {
		if (!primaryResult.result) {
			// This shouldn't happen, but handle gracefully
			finalResults.push({
				originalCard: primaryResult.card,
				moxfieldRow: {
					Count: primaryResult.card.count.toString(),
					Name: primaryResult.card.name || '',
					Edition: primaryResult.card.edition || '',
					Condition: primaryResult.card.condition || defaultCondition || 'Near Mint',
					Language: primaryResult.card.language || 'English',
					Foil: primaryResult.card.foil || '',
					'Last Modified': primaryResult.card.lastModified || '',
					'Collector Number': primaryResult.card.collectorNumber || '',
					Alter: primaryResult.card.alter || 'FALSE',
					Proxy: primaryResult.card.proxy || 'FALSE',
					Signed: primaryResult.card.signed || 'FALSE',
					'Purchase Price': primaryResult.card.purchasePrice || ''
				},
				success: false,
				confidence: 'low',
				initialConfidence: primaryResult.card.initialConfidence,
				identificationMethod: 'failed',
				error: 'No primary result available',
				warnings: primaryResult.card.warnings,
				setCodeCorrected: primaryResult.card.setCodeCorrected,
				sourceRowNumber: primaryResult.card.sourceRowNumber
			});
			processed++;
			continue;
		}

		const { card, result } = primaryResult;

		// If lookup failed or no Scryfall card, add as-is
		if (!result.success || !result.scryfallCard) {
			finalResults.push(result);
			processed++;
			continue;
		}

		// Check language match if language was specified
		if (card.language && card.language.trim() !== '') {
			console.log(
				`Processing language validation for ${card.name}: requested "${card.language}", got "${result.scryfallCard.lang}", method: "${result.identificationMethod}"`
			);

			const isNameOnlyLookup = result.identificationMethod === 'name_only';

			if (isNameOnlyLookup) {
				// For name-only entries, simply pass the source language to output without validation
				console.log(`Name-only lookup for ${card.name}: using source language ${card.language}`);
				const updatedResult = { ...result };

				// Get proper Scryfall language code for output
				const scryfallLanguageCode = getScryfallLanguageCode(card.language);
				if (scryfallLanguageCode) {
					// Update the result to use the requested language for output
					updatedResult.scryfallCard = {
						...result.scryfallCard,
						lang: scryfallLanguageCode
					};
				}

				// No confidence downgrade or warnings for name-only lookups
				finalResults.push(updatedResult);
			} else {
				// For non-name-only lookups, check if languages match
				const languageMatch = validateLanguageMatch(card.language, result.scryfallCard.lang);
				console.log(
					`Language match result for ${card.name}: ${languageMatch} (requested: "${card.language}", got: "${result.scryfallCard.lang}")`
				);

				if (!languageMatch) {
					// True language mismatch detected - attempt secondary lookup
					console.log(
						`Language mismatch for ${card.name}: requested "${card.language}", got "${result.scryfallCard.lang}"`
					);

					const scryfallLanguageCode = getScryfallLanguageCode(card.language);
					console.log(`Scryfall language code for "${card.language}": ${scryfallLanguageCode}`);

					if (
						scryfallLanguageCode &&
						result.scryfallCard.set &&
						result.scryfallCard.collector_number
					) {
						try {
							console.log(
								`Attempting language-specific lookup for ${card.name} in ${scryfallLanguageCode}`
							);

							// Add rate limiting delay before secondary lookup
							await applyRateLimit();

							const languageSpecificCard = await fetchScryfallCardByLanguage(
								result.scryfallCard.set,
								result.scryfallCard.collector_number,
								scryfallLanguageCode
							);

							if (languageSpecificCard) {
								// Found language-specific version - this is a complete success
								console.log(`Found language-specific card for ${card.name}`);
								const languageResult = createSuccessfulResult(card, languageSpecificCard);
								finalResults.push(languageResult);
							} else {
								// Language-specific version not found - THIS IS THE ONLY TRUE MISMATCH
								console.log(
									`Language-specific card not found for ${card.name}, falling back to original`
								);
								const fallbackResult = { ...result };

								fallbackResult.confidence = downgradeConfidence(result.confidence);
								fallbackResult.languageMismatch = true;
								fallbackResult.warnings = [
									...(result.warnings || []),
									`Language mismatch: requested "${card.language}", "${scryfallLanguageCode}" version not available, using "${result.scryfallCard.lang}" version`
								];

								finalResults.push(fallbackResult);
							}
						} catch (error) {
							console.error(`Error during language-specific lookup for ${card.name}:`, error);

							// Fall back to original result with warning about failed lookup - THIS IS A TRUE MISMATCH
							const errorResult = { ...result };
							errorResult.confidence = downgradeConfidence(result.confidence);
							errorResult.languageMismatch = true;
							errorResult.warnings = [
								...(result.warnings || []),
								`Language mismatch: requested "${card.language}", secondary lookup failed, using "${result.scryfallCard.lang}" version`
							];

							finalResults.push(errorResult);
						}
					} else {
						// Invalid language code or missing set/collector info - THIS IS A TRUE MISMATCH
						console.log(
							`Cannot perform secondary lookup for ${card.name}: scryfallLanguageCode=${scryfallLanguageCode}, set=${result.scryfallCard.set}, collector_number=${result.scryfallCard.collector_number}`
						);
						const updatedResult = { ...result };
						updatedResult.confidence = downgradeConfidence(result.confidence);
						updatedResult.languageMismatch = true;

						if (!scryfallLanguageCode) {
							updatedResult.warnings = [
								...(result.warnings || []),
								`Language mismatch: unrecognized language "${card.language}", using "${result.scryfallCard.lang}" version`
							];
						} else {
							updatedResult.warnings = [
								...(result.warnings || []),
								`Language mismatch: requested "${card.language}", cannot perform secondary lookup (missing set/collector info), using "${result.scryfallCard.lang}" version`
							];
						}

						finalResults.push(updatedResult);
					}
				} else {
					// Language matches (including aliases) - use Collection endpoint data as-is
					console.log(`Language matches for ${card.name}, using Collection endpoint data`);
					finalResults.push(result);
				}
			}
		} else {
			// No language specified - use Collection endpoint data as-is
			console.log(`No language specified for ${card.name}, using Collection endpoint data`);
			finalResults.push(result);
		}

		processed++;
		if (progressCallback) {
			const progress = 80 + (processed / total) * 20; // 80-100% range
			progressCallback(Math.min(100, progress));
		}
	}

	if (progressCallback) progressCallback(100);

	return finalResults;
}
