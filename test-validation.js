import { createConverterEngine } from './src/lib/converter-engine-new.js';
import fs from 'fs';

async function testValidation() {
	const engine = createConverterEngine();

	// Read the test file
	const testFile = new File([fs.readFileSync('test_slow.csv')], 'test_slow.csv', {
		type: 'text/csv'
	});

	try {
		// Auto-detect format
		const content = await testFile.text();
		const lines = content.split('\n');
		const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim());

		console.log('Headers:', headers);

		const format = engine.detectFormat(headers);
		console.log('Detected format:', format);

		if (!format) {
			console.log('Could not detect format');
			return;
		}

		// Convert the file
		const results = await engine.convertFile(testFile, format, (progress) => {
			console.log(`Progress: ${progress.toFixed(1)}%`);
		});

		console.log(`\nProcessed ${results.length} cards:`);

		// Show results, especially focusing on validation errors
		results.forEach((result, index) => {
			const card = result.originalCard;
			console.log(
				`\n${index + 1}. ${card.name} (${card.edition}${card.collectorNumber ? ` #${card.collectorNumber}` : ''})`
			);
			console.log(`   Success: ${result.success}`);
			console.log(`   Confidence: ${result.confidence}`);
			console.log(`   Method: ${result.identificationMethod}`);
			if (result.error) {
				console.log(`   Error: ${result.error}`);
			}
			if (result.scryfallCard) {
				console.log(
					`   Scryfall: ${result.scryfallCard.name} (${result.scryfallCard.set} #${result.scryfallCard.collector_number})`
				);
			}
		});
	} catch (error) {
		console.error('Error during conversion:', error);
	}
}

testValidation();
