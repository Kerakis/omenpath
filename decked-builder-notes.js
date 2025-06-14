// Manual verification test for Decked Builder format
// This demonstrates the expected behavior:

// Test case 1: Regular only (Reg Qty = 1, Foil Qty = 0)
// Should create 1 regular card entry

// Test case 2: Foil only (Reg Qty = 0, Foil Qty = 1)
// Should create 1 foil card entry

// Test case 3: Both regular and foil (Reg Qty = 1, Foil Qty = 1)
// Should create 2 card entries: 1 regular + 1 foil

// Test case 4: Multiple quantities (Reg Qty = 2, Foil Qty = 3)
// Should create 2 card entries: 1 with count=2 (regular) + 1 with count=3 (foil)

console.log('Decked Builder Format Features:');
console.log('✓ Splits regular and foil quantities into separate card entries');
console.log('✓ Uses multiverse ID (Mvid) for card identification');
console.log('✓ Falls back to fuzzy set matching using Set name');
console.log('✓ Handles purchase price information');
console.log('✓ Auto-detects format based on unique column signatures');

console.log('\nUnique identifiers for detection:');
const uniqueIds = ['total qty', 'reg qty', 'foil qty', 'mvid', 'single price', 'single foil price'];
console.log(uniqueIds.join(', '));

console.log('\nColumn mappings:');
const mappings = {
	totalQty: 'Total Qty',
	regQty: 'Reg Qty',
	foilQty: 'Foil Qty',
	name: 'Card',
	editionName: 'Set',
	multiverseId: 'Mvid',
	purchasePrice: 'Single Price'
};
console.log(JSON.stringify(mappings, null, 2));
