// Test etched foil parsing for different formats
import { parseEtchedFoil } from './src/lib/utils/format-helpers.js';

console.log('Testing etched foil parsing...\n');

// Test Archidekt format
console.log('Archidekt format:');
console.log(parseEtchedFoil('archidekt', { Finish: 'Etched' }));
console.log(parseEtchedFoil('archidekt', { Finish: 'Foil' }));
console.log(parseEtchedFoil('archidekt', { Finish: 'Normal' }));
console.log('');

// Test Cardsphere format
console.log('Cardsphere format:');
console.log(parseEtchedFoil('cardsphere', {}, 'MH2', 'Modern Horizons 2 Retro Frame Etched Foil'));
console.log(parseEtchedFoil('cardsphere', {}, 'MH2', 'Modern Horizons 2 Retro Frame'));
console.log('');

// Test DeckBox format
console.log('DeckBox format:');
console.log(parseEtchedFoil('deckbox', {}, 'MH2_E', 'Modern Horizons 2 Etched'));
console.log(parseEtchedFoil('deckbox', {}, 'MH2', 'Modern Horizons 2'));
console.log('');

// Test TCGPlayer format
console.log('TCGPlayer format:');
console.log(parseEtchedFoil('tcgplayer', { Name: 'Najeela, the Blade-Blossom (Foil Etched)' }));
console.log(parseEtchedFoil('tcgplayer', { Name: 'Najeela, the Blade-Blossom' }));
console.log('');

// Test Urza's Gatherer format
console.log("Urza's Gatherer format:");
console.log(parseEtchedFoil('urzasgatherer', { 'Special foil count': '2' }));
console.log(parseEtchedFoil('urzasgatherer', { 'Special foil count': '0' }));
