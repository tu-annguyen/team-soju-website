// @ts-check
import { randomUUID } from 'node:crypto';
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';

const buildId = [
  process.env.APP_BUILD_ID,
  process.env.GITHUB_SHA,
  process.env.CI_COMMIT_SHA,
  process.env.BUILD_SOURCEVERSION,
  process.env.VERCEL_GIT_COMMIT_SHA,
  process.env.VERCEL_DEPLOYMENT_ID,
].find((value) => typeof value === 'string' && value.trim().length > 0) || randomUUID();

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
