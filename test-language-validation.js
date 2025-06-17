// Test language validation
import { createConverterEngine } from './src/lib/converter-engine-new.js';

// Test the language validation function
const testCases = [
	{ original: 'English', scryfall: 'en', shouldMatch: true },
	{ original: 'EN', scryfall: 'en', shouldMatch: true },
	{ original: 'en', scryfall: 'en', shouldMatch: true },
	{ original: 'Japanese', scryfall: 'ja', shouldMatch: true },
	{ original: 'jp', scryfall: 'ja', shouldMatch: true },
	{ original: 'Spanish', scryfall: 'es', shouldMatch: true },
	{ original: 'sp', scryfall: 'es', shouldMatch: true },
	{ original: 'French', scryfall: 'fr', shouldMatch: true },
	{ original: 'German', scryfall: 'de', shouldMatch: true },
	{ original: 'Portuguese', scryfall: 'pt', shouldMatch: true },
	{ original: 'Korean', scryfall: 'ko', shouldMatch: true },
	{ original: 'kr', scryfall: 'ko', shouldMatch: true },
	{ original: 'Chinese Simplified', scryfall: 'zhs', shouldMatch: true },
	{ original: 'cs', scryfall: 'zhs', shouldMatch: true },
	{ original: 'Chinese Traditional', scryfall: 'zht', shouldMatch: true },
	{ original: 'ct', scryfall: 'zht', shouldMatch: true },
	{ original: 'Russian', scryfall: 'ru', shouldMatch: true },
	{ original: 'Italian', scryfall: 'it', shouldMatch: true },
	{ original: 'Phyrexian', scryfall: 'ph', shouldMatch: true },
	{ original: 'Hebrew', scryfall: 'he', shouldMatch: true },
	{ original: 'Latin', scryfall: 'la', shouldMatch: true },
	{ original: 'Ancient Greek', scryfall: 'grc', shouldMatch: true },
	{ original: 'Arabic', scryfall: 'ar', shouldMatch: true },
	{ original: 'Sanskrit', scryfall: 'sa', shouldMatch: true },
	{ original: 'Quenya', scryfall: 'qya', shouldMatch: true },
	// Mismatch cases
	{ original: 'English', scryfall: 'ja', shouldMatch: false },
	{ original: 'jp', scryfall: 'en', shouldMatch: false },
	{ original: 'Spanish', scryfall: 'fr', shouldMatch: false }
];

// Since we can't directly import the function, let's test it through the validation
// by creating mock cards and seeing if validation passes
console.log('Language validation test cases:');

testCases.forEach((testCase, index) => {
	// We'll need to create a simple test that doesn't require full Scryfall API calls
	console.log(
		`${index + 1}. ${testCase.original} -> ${testCase.scryfall}: Expected ${testCase.shouldMatch ? 'MATCH' : 'MISMATCH'}`
	);
});

console.log(
	'\nTo fully test this, we would need to run actual conversions with cards that have language data.'
);
console.log(
	'The test_slow.csv has "EN" and "JA" language values that should be validated correctly.'
);
