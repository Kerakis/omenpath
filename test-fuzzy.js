// Quick test of fuzzy set matching
import { fetchScryfallSets, fuzzyMatchSetName } from './src/lib/converter-engine.ts';

async function testFuzzyMatching() {
	try {
		console.log('Fetching Scryfall sets...');
		const sets = await fetchScryfallSets();
		console.log(`Fetched ${sets.length} sets`);

		// Test some fuzzy matches
		const testCases = [
			'Magic 2010',
			'Beta',
			'Unlimited',
			'Alpha',
			'Battle for Zendikar',
			'Return to Ravnica'
		];

		for (const testCase of testCases) {
			const match = fuzzyMatchSetName(testCase, sets);
			console.log(`"${testCase}" -> ${match ? `"${match.name}" (${match.code})` : 'No match'}`);
		}
	} catch (error) {
		console.error('Error testing fuzzy matching:', error);
	}
}

testFuzzyMatching();
