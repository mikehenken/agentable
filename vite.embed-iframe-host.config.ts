/**
 * vite.embed-iframe-host.config.ts — sandboxed iframe host page for.
 *
 * Emits:
 * - dist/embed/iframe-host.html
 * - dist/embed/iframe-host*.js (entry + chunks)
 */
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repoRoot = __dirname;
const embedRoot = path.resolve(repoRoot, 'embed');

export default defineConfig({
  root: embedRoot,
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(repoRoot, './src'),
      '@agentable/career-pack': path.resolve(repoRoot, './packages/career-pack/src/index.ts'),
    },
  },
  define: {
    // G3: shipped embed bundles never inline a provider key, whatever the
    // local .env.local carries for vite dev. The embeds' only sanctioned
    // credential source at runtime is a token-endpoint / chat proxy.
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(''),
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: path.resolve(repoRoot, 'dist/embed'),
    emptyOutDir: false,
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      input: path.resolve(embedRoot, 'iframe-host.html'),
      output: {
        entryFileNames: 'iframe-host-[name].js',
        chunkFileNames: 'iframe-host-[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.html')) {
            return 'iframe-host.html';
          }
          return assetInfo.name ?? 'asset-[hash][extname]';
        },
      },
    },
  },
});
