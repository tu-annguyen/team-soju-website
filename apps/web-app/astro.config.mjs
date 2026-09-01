// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), react()],
  vite: {
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
