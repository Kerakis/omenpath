// Simple test to understand the detection issue
console.log('=== Format Detection Debug ===');

// Test the headers that are failing
const headers = [
	'Quantity',
	'Name',
	'Edition',
	'Collector Number',
	'Condition',
	'Foil',
	'Scryfall ID'
];

console.log('Testing headers:', headers);
console.log(
	'Lowercase headers:',
	headers.map((h) => h.toLowerCase())
);

// Check which headers match Moxfield strong indicators
const moxfieldStrong = ['scryfall id', 'edition'];
const moxfieldCommon = ['quantity', 'name', 'collector number', 'condition', 'foil'];

const lowercaseHeaders = headers.map((h) => h.toLowerCase());
const headerSet = new Set(lowercaseHeaders);

console.log('\n=== Moxfield Detection ===');
console.log('Strong indicators:', moxfieldStrong);
console.log(
	'Strong matches:',
	moxfieldStrong.filter((h) => headerSet.has(h))
);
console.log('Common indicators:', moxfieldCommon);
console.log(
	'Common matches:',
	moxfieldCommon.filter((h) => headerSet.has(h))
);

// Check Helvault too
const helvaultStrong = ['set_code', 'collector_number'];
const helvaultCommon = ['quantity', 'name', 'condition', 'language', 'foil'];

console.log('\n=== Helvault Detection ===');
console.log('Strong indicators:', helvaultStrong);
console.log(
	'Strong matches:',
	helvaultStrong.filter((h) => headerSet.has(h))
);
console.log('Common indicators:', helvaultCommon);
console.log(
	'Common matches:',
	helvaultCommon.filter((h) => headerSet.has(h))
);

// Manual scoring
function calculateScore(strongIndicators, commonIndicators, headerSet) {
	let score = 0;
	let strongMatches = 0;

	// Check strong indicators
	for (const indicator of strongIndicators) {
		if (headerSet.has(indicator.toLowerCase())) {
			strongMatches++;
			score += 0.3;
		}
	}

	// Check common indicators
	for (const indicator of commonIndicators) {
		if (headerSet.has(indicator.toLowerCase())) {
			score += 0.1;
		}
	}

	// Bonus for having strong indicators
	if (strongMatches > 0) {
		score += 0.2;
	}

	return { score: Math.min(score, 1.0), strongMatches };
}

const moxfieldScore = calculateScore(moxfieldStrong, moxfieldCommon, headerSet);
const helvaultScore = calculateScore(helvaultStrong, helvaultCommon, headerSet);

console.log('\n=== Calculated Scores ===');
console.log('Moxfield:', moxfieldScore);
console.log('Helvault:', helvaultScore);
