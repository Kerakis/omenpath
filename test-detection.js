import { createConverterEngine } from './src/lib/converter-engine-new.js';

const engine = createConverterEngine();

// Test Moxfield format headers
const moxfieldHeaders = ['Quantity', 'Name', 'Set', 'Condition', 'Language', 'Foil'];
console.log('Moxfield headers:', moxfieldHeaders);
console.log('Detected format:', engine.detectFormat(moxfieldHeaders));

// Test ManaBox format headers
const manaboxHeaders = [
	'Quantity',
	'Name',
	'Set Code',
	'Collector Number',
	'Condition',
	'Language',
	'Foil',
	'Scryfall ID',
	'Binder Name'
];
console.log('\nManaBox headers:', manaboxHeaders);
console.log('Detected format:', engine.detectFormat(manaboxHeaders));

// Show all available formats
console.log('\nAll supported formats:');
engine.getSupportedFormats().forEach((format) => {
	console.log(`- ${format.name} (${format.id})`);
});
