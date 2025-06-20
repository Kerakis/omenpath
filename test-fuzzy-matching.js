// Simple test script to validate fuzzy matching improvements
import { findSetCodeByName } from './src/lib/utils/scryfall-utils.js';

// Test cases that should prefer parent sets
const testCases = [
	{ search: 'Innistrad', expected: 'isd' },
	{ search: 'Strixhaven', expected: 'stx' },
	{ search: 'Strixhaven: School of Mages', expected: 'stx' },
	{ search: 'Zendikar', expected: 'zen' },
	{ search: 'Zendikar Rising', expected: 'znr' },
	{ search: 'Kaldheim', expected: 'khm' },
	{ search: 'Kamigawa', expected: 'chk' },
	{ search: 'Kamigawa: Neon Dynasty', expected: 'neo' }
];

console.log('Testing fuzzy set matching...\n');

for (const testCase of testCases) {
	try {
		const result = await findSetCodeByName(testCase.search);
		const status = result.code === testCase.expected ? '✅ PASS' : '❌ FAIL';
		console.log(
			`${status} "${testCase.search}" -> ${result.code} (expected: ${testCase.expected})`
		);
		if (result.matchedName) {
			console.log(
				`    Matched: "${result.matchedName}" (confidence: ${result.confidence.toFixed(3)})`
			);
		}
	} catch (error) {
		console.log(`❌ ERROR "${testCase.search}" -> ${error.message}`);
	}
	console.log('');
}
