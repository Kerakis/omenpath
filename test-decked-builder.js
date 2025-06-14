import { createConverterEngine } from './src/lib/converter-engine.js';
import fs from 'fs';

async function testDeckedBuilder() {
	try {
		// Read the CSV file
		const csvContent = fs.readFileSync('./static/CSV Examples/Decked Builder/decked.csv', 'utf-8');

		// Create a mock File object
		const file = new File([csvContent], 'decked.csv', { type: 'text/csv' });

		// Create converter engine
		const converter = createConverterEngine();
		const formats = converter.getSupportedFormats();

		// Check if Decked Builder format is present
		const deckedFormat = formats.find((f) => f.id === 'decked-builder');
		console.log('Decked Builder format found:', deckedFormat ? 'Yes' : 'No');
		if (deckedFormat) {
			console.log('Format description:', deckedFormat.description);
		}

		// Test format detection
		const headers = csvContent.split('\n')[0].split(',');
		console.log('CSV headers:', headers);

		const detectedFormat = converter.detectFormat(headers);
		console.log('Detected format:', detectedFormat);

		// Parse the file
		console.log('\nParsing CSV...');
		const parsedCards = await converter.parseFile(file, 'decked-builder');
		console.log(`Parsed ${parsedCards.length} card entries`);

		// Show first few cards to verify quantity splitting
		console.log('\nFirst 10 parsed cards:');
		parsedCards.slice(0, 10).forEach((card, i) => {
			console.log(
				`${i + 1}. ${card.name} - Count: ${card.count}, Foil: ${card.foil || 'none'}, Set: ${card.editionName}, Multiverse ID: ${card.multiverseId}`
			);
		});
	} catch (error) {
		console.error('Test failed:', error);
		console.error(error.stack);
	}
}

testDeckedBuilder();
