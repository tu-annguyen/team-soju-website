import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const packageDirectory = dirname(fileURLToPath(import.meta.url));
const sourceDirectory = resolve(packageDirectory, 'src');
const outputDirectory = resolve(packageDirectory, 'dist');

const commonOptions = {
  bundle: true,
  logLevel: 'info',
  packages: 'external',
  sourcemap: true,
  target: 'node20',
};

await rm(outputDirectory, { recursive: true, force: true });

await Promise.all([
  build({
    ...commonOptions,
    entryPoints: [resolve(sourceDirectory, 'index.js')],
    format: 'esm',
    platform: 'browser',
    outfile: resolve(outputDirectory, 'index.mjs'),
  }),
  build({
    ...commonOptions,
    entryPoints: [resolve(sourceDirectory, 'node.js')],
    format: 'cjs',
    platform: 'node',
    outfile: resolve(outputDirectory, 'index.cjs'),
  }),
  build({
    ...commonOptions,
    entryPoints: [resolve(sourceDirectory, 'pokeapi.js')],
    format: 'esm',
    platform: 'node',
    outfile: resolve(outputDirectory, 'pokeapi.mjs'),
  }),
  build({
    ...commonOptions,
    entryPoints: [resolve(sourceDirectory, 'pokeapi.js')],
    format: 'cjs',
    platform: 'node',
    outfile: resolve(outputDirectory, 'pokeapi.cjs'),
  }),
  build({
    ...commonOptions,
    entryPoints: [resolve(sourceDirectory, 'variant-filter.js')],
    format: 'esm',
    platform: 'node',
    outfile: resolve(outputDirectory, 'variant-filter.mjs'),
  }),
  build({
    ...commonOptions,
    entryPoints: [resolve(sourceDirectory, 'variant-filter.js')],
    format: 'cjs',
    platform: 'node',
    outfile: resolve(outputDirectory, 'variant-filter.cjs'),
  }),
]);
