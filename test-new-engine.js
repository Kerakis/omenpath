import { createConverterEngine, detectFormatFromContent } from './src/lib/converter-engine-new.js';

async function testNewEngine() {
	console.log('Testing new converter engine...');

	// Test CSV parsing with quoted fields
	const testCsv = `Count,Name,Edition,Condition
1,"Lightning Bolt","4ED","Near Mint"
2,"Birds of Paradise, Test","LEA","Good"
1,"Force of Will","ALL",MP`;

	console.log('\n--- Testing CSV parsing ---');
	const detection = detectFormatFromContent(testCsv);
	console.log('Format detection result:', detection);

	if (!detection) {
		console.log('No format detected, trying manual format...');
		return;
	}

	// Create engine and test conversion
	const engine = createConverterEngine();

	// Create a test file-like object
	const testFile = new File([testCsv], 'test.csv', { type: 'text/csv' });

	console.log('\n--- Testing conversion ---');
	try {
		const results = await engine.convertFile(
			testFile,
			detection.format.id,
			(progress) => console.log(`Progress: ${progress.toFixed(1)}%`),
			'Near Mint'
		);

		console.log(`\nConversion completed! Found ${results.length} results:`);
		results.forEach((result, index) => {
			console.log(`\n${index + 1}. ${result.originalCard.name}`);
			console.log(`   Success: ${result.success}`);
			console.log(`   Confidence: ${result.confidence}`);
			console.log(`   Method: ${result.identificationMethod}`);
			if (result.scryfallCard) {
				console.log(
					`   Scryfall: ${result.scryfallCard.name} (${result.scryfallCard.set.toUpperCase()})`
				);
			}
			if (result.error) {
				console.log(`   Error: ${result.error}`);
			}
		});

		console.log('\n--- Success! New engine is working with PapaParse and Scryfall API ---');
	} catch (error) {
		console.error('Error during conversion:', error);
	}
}

testNewEngine().catch(console.error);
