import gifwrap from 'gifwrap';

export * from './index.js';

const { GifCodec, GifUtil } = gifwrap;
let pokeApiPromise;

function loadPokeApi() {
  return (pokeApiPromise ??= import('./pokeapi.js'));
}

export async function getSpriteUrl(nameOrId, options) {
  return (await loadPokeApi()).getSpriteUrl(nameOrId, options);
}

export async function getNationalNumber(nameOrId) {
  return (await loadPokeApi()).getNationalNumber(nameOrId);
}

export async function getPokemonVariants(nameOrId) {
  return (await loadPokeApi()).getPokemonVariants(nameOrId);
}

export async function getPokemonEvolutionLine(nameOrId) {
  return (await loadPokeApi()).getPokemonEvolutionLine(nameOrId);
}

/**
 * Fetch a GIF and convert every frame to grayscale.
 * This utility is Node-only because it returns a Buffer and uses gifwrap.
 */
export async function greyscale(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  const inputBuffer = Buffer.from(await response.arrayBuffer());
  const inputGif = await GifUtil.read(inputBuffer);

  inputGif.frames.forEach((frame) => {
    const { data } = frame.bitmap;

    for (let index = 0; index < data.length; index += 4) {
      const gray = (data[index] * 0.299)
        + (data[index + 1] * 0.587)
        + (data[index + 2] * 0.114);
      data[index] = gray;
      data[index + 1] = gray;
      data[index + 2] = gray;
    }
  });

  const codec = new GifCodec();
  const encodedGif = await codec.encodeGif(inputGif.frames, { loops: inputGif.loops });
  return encodedGif.buffer;
}
