import { fileURLToPath } from 'node:url';
import basicSsl from '@vitejs/plugin-basic-ssl';
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

/** Same redirect for Vite's dependency pre-bundler (dev server), which does not run app plugins. */
const optimizerShim = {
  name: 'mind-ar-three-shim',
  resolveId(source: string, importer?: string) {
    if (source === 'three' && importer && /[\\/]node_modules[\\/]mind-ar[\\/]/.test(importer)) {
      return threeCompat;
    }
    return null;
  },
};

export default defineConfig({
  // HTTPS=1 npm run dev:https → self-signed certificate, needed for the phone camera over the local network.
  plugins: [mindArThreeShim(), react(), ...(process.env.HTTPS ? [basicSsl()] : [])],
  optimizeDeps: {
    rolldownOptions: { plugins: [optimizerShim] },
  },
  build: {
    // The Quest 1 browser stopped updating in 2023: keep the output readable by older Chromium builds.
    target: 'es2020',
    // three + react ≈ 0.9 MB. MindAR (≈1.3 MB) is its own chunk and only loads in AR mode.
    chunkSizeWarningLimit: 1400,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
});
