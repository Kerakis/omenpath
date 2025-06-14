// Simple test to check the CSV headers and our format definition
const csvContent = `Total Qty,Reg Qty,Foil Qty,Card,Set,Mana Cost,Card Type,Color,Rarity,Mvid,Single Price,Single Foil Price,Total Price,Price Source,Notes
1,1,0,Abrade,Crimson Vow Art Series,,Card,Artifact,Common,1281376,,,,TCGplayer Market,
1,1,0,Abrade,Magic Online Promos,1R,Instant,Red,Uncommon,1288256,,,,TCGplayer Market,
1,0,1,Abraded Bluffs,Outlaws of Thunder Junction,,Land — Desert,Land,Common,1297512,0.19,0.19,0.19,TCGplayer Market,`;

const lines = csvContent.split('\n');
const headers = lines[0].split(',');
console.log('Headers:', headers);
console.log(
	'Headers (lowercase):',
	headers.map((h) => h.toLowerCase())
);

// Check if our unique identifiers would match
const uniqueIdentifiers = [
	'total qty',
	'reg qty',
	'foil qty',
	'mvid',
	'single price',
	'single foil price'
];
const headerSet = new Set(headers.map((h) => h.toLowerCase().trim()));
const matches = uniqueIdentifiers.filter((id) => headerSet.has(id));
console.log('Unique identifier matches:', matches);

// Test parsing a single line
const dataLine = lines[1];
const values = dataLine.split(',');
console.log('First data line values:', values);

// Map to our format
const mapping = {
	totalQty: values[0],
	regQty: values[1],
	foilQty: values[2],
	name: values[3],
	set: values[4],
	mvid: values[9]
};
console.log('Mapped values:', mapping);

// Test the quantity logic
const regQty = parseInt(mapping.regQty) || 0;
const foilQty = parseInt(mapping.foilQty) || 0;
console.log(`Card: ${mapping.name}, Reg Qty: ${regQty}, Foil Qty: ${foilQty}`);

if (regQty > 0) {
	console.log(`Would create regular card with count: ${regQty}`);
}
if (foilQty > 0) {
	console.log(`Would create foil card with count: ${foilQty}`);
}
