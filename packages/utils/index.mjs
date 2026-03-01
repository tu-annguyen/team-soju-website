// ESM entrypoint for @team-soju/utils
// Only export functionality safe for browser/SSR (no sharp, axios, etc.)
// The CJS `index.js` remains the Node/bot entrypoint.
// For the browser/ASTRO side we re‑export the core pokeapi helpers
// from the implementation wrapper, which itself is pure ESM.

export { getSpriteUrl, getNationalNumber } from './pokeapi.mjs';