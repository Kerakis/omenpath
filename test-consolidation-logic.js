// Test consolidation logic manually

// Mock card data that should be consolidated
const testCards = [
	{
		originalData: {},
		count: 1,
		name: 'Lightning Bolt',
		edition: '',
		editionName: 'Beta',
		condition: '',
		language: '',
		foil: '', // regular
		needsLookup: true
	},
	{
		originalData: {},
		count: 1,
		name: 'Lightning Bolt',
		edition: '',
		editionName: 'Beta',
		condition: '',
		language: '',
		foil: '', // regular - should consolidate with first
		needsLookup: true
	},
	{
		originalData: {},
		count: 1,
		name: 'Lightning Bolt',
		edition: '',
		editionName: 'Beta',
		condition: '',
		language: '',
		foil: 'foil', // foil - different from regular
		needsLookup: true
	},
	{
		originalData: {},
		count: 2,
		name: 'Sol Ring',
		edition: '',
		editionName: 'Alpha',
		condition: '',
		language: '',
		foil: '',
		needsLookup: true
	}
];

console.log('Before consolidation:', testCards.length, 'cards');
testCards.forEach((card, i) => {
	console.log(`${i + 1}. ${card.name} (${card.foil || 'regular'}) - Count: ${card.count}`);
});

// Expected result:
// 1. Lightning Bolt (regular) - Count: 2 (consolidated)
// 2. Lightning Bolt (foil) - Count: 1
// 3. Sol Ring (regular) - Count: 2

console.log('\nExpected after consolidation: 3 cards');
console.log('1. Lightning Bolt (regular) - Count: 2');
console.log('2. Lightning Bolt (foil) - Count: 1');
console.log('3. Sol Ring (regular) - Count: 2');
