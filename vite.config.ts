import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const threeCompat = fileURLToPath(new URL('./src/ar/threeCompat.ts', import.meta.url));

/**
 * mind-ar's three bundle still imports `sRGBEncoding`, which three removed in r162.
 * Only imports that come *from inside mind-ar* are redirected to a thin shim, so the
 * rest of the app keeps using plain `three`. The shim lives next to the AR adapters.
 */
function mindArThreeShim(): Plugin {
  return {
    name: 'mind-ar-three-shim',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === 'three' && importer && /[\\/]node_modules[\\/]mind-ar[\\/]/.test(importer)) {
        return threeCompat;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [mindArThreeShim(), react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
});
