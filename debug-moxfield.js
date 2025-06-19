import { formatAutoDetector } from './src/lib/core/detection/index.js';

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
const result = formatAutoDetector.detectFormat(headers);

console.log('Detection result:', result);

if (result) {
	console.log('Detected format:', result.format.id);
	console.log('Confidence:', result.confidence);
	console.log('Matching headers:', result.matchingHeaders);
} else {
	console.log('No format detected');
}

// Test each format module individually
console.log('\n=== Individual format module tests ===');
const modules = formatAutoDetector.getAllFormats();

for (const module of modules) {
	const confidence = module.detectFormat(headers);
	console.log(`${module.format.id}: ${confidence}`);
}
