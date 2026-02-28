// Image processing utilities for Team Soju projects
// use axios + sharp to support more formats (GIFs etc.)
const { GifUtil, GifCodec } = require('gifwrap');

/**
 * Fetches a GIF from a URL and converts it to grayscale.
 * @param {string} url - The source GIF URL.
 * @returns {Promise<Buffer>} - The processed GIF as a Buffer.
 */
async function greyscale(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Read the GIF
    const gif = await GifUtil.read(inputBuffer);
    
    // Manually apply grayscale to each frame
    gif.frames.forEach(frame => {
        const { data } = frame.bitmap; // This is the RGBA Buffer
        for (let i = 0; i < data.length; i += 4) {
            // Luma formula for accurate grayscale
            const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            
            data[i]     = gray; // Red
            data[i + 1] = gray; // Green
            data[i + 2] = gray; // Blue
            // data[i + 3] is Alpha (transparency), we leave it as is
        }
    });

    // Encode frames back into a Buffer
    const codec = new GifCodec();
    const encodedGif = await codec.encodeGif(gif.frames, { loops: gif.loops });
    
    return encodedGif.buffer;
}

// PokeAPI utilities for fetching Pokémon data (CJS version)
const pokeapi = require('./pokeapi.cjs');

module.exports = {
  greyscale,
  ...pokeapi
};