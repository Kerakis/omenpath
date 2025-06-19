import { formatAutoDetector } from '../lib/core/detection/auto-detector.js';

// Test the first failing case - Moxfield headers being detected as Archidekt
const moxfieldHeaders = [
	'Quantity',
	'Name',
	'Edition',
	'Collector Number',
	'Condition',
	'Foil',
	'Scryfall ID'
];
console.log('=== Moxfield Headers Test ===');
console.log('Headers:', moxfieldHeaders);
const moxfieldResult = formatAutoDetector.detectFormat(moxfieldHeaders);
console.log('Result:', moxfieldResult);

// Test Archidekt headers being detected as DeckBox
const archidektHeaders = [
	'Count',
	'Name',
	'Edition',
	'Card Number',
	'Condition',
	'Language',
	'Foil',
	'Tags',
	'Last Modified',
	'Collector Number',
	'Alter',
	'Proxy',
	'Purchase Price'
];
console.log('\n=== Archidekt Headers Test ===');
console.log('Headers:', archidektHeaders);
const archidektResult = formatAutoDetector.detectFormat(archidektHeaders);
console.log('Result:', archidektResult);

// Test ManaBox headers being detected as Cardsphere
const manaboxHeaders = [
	'Quantity',
	'Name',
	'Simple Name',
	'Card Name',
	'Set Name',
	'Set Code',
	'Cost',
	'Type'
];
console.log('\n=== ManaBox Headers Test ===');
console.log('Headers:', manaboxHeaders);
const manaboxResult = formatAutoDetector.detectFormat(manaboxHeaders);
console.log('Result:', manaboxResult);

// Get all formats to see what we have
console.log('\n=== All Formats ===');
const allFormats = formatAutoDetector.getAllFormats();
allFormats.forEach((format) => console.log(`${format.id}: ${format.name}`));
