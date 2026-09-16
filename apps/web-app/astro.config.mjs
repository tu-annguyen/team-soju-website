// @ts-check
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import { deriveWebAppBuildId } from './build/derive-build-id.mjs';

const webAppDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = resolve(webAppDirectory, '../..');
const explicitBuildId = process.env.APP_BUILD_ID?.trim();
const buildId = explicitBuildId || deriveWebAppBuildId(repositoryDirectory, process.env);

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), react()],
  vite: {
    define: {
      'import.meta.env.PUBLIC_APP_BUILD_ID': JSON.stringify(buildId),
    },
    optimizeDeps: {
      include: [
        'flatpickr',
        'flatpickr/dist/l10n/es.js',
        'flatpickr/dist/l10n/zh.js',
        'react-flatpickr',
      ],
    },
  },
});
