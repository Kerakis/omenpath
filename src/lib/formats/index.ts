// Export all format modules and utilities
export * from './base.js';
export * from './auto-detector.js';
export * from './format-helpers.js';
export * from './manabox.js';
export * from './archidekt.js';
export * from './deckbox.js';
export * from './cardcastle.js';
export * from './cardsphere.js';
export * from './cubecobra.js';
export * from './deckedbuilder.js';
export * from './delverlens.js';
export * from './dragonshield.js';
export * from './helvault.js';
export * from './moxfield.js';
export * from './mtgo.js';
export * from './tappedout.js';
export * from './tcgplayer.js';
export * from './deckstats.js';

// Re-export the auto-detector for easy access
export { formatAutoDetector as autoDetector } from './auto-detector.js';
