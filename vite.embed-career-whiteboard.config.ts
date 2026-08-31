/**
 * vite.embed-career-whiteboard.config.ts — combined `<agentable-whiteboard>`
 * + career-pack wiring in ONE bundle (avoids duplicate tldraw at runtime).
 *
 * Emits:
 * - dist/embed/career-whiteboard.js (ESM)
 * - dist/embed/career-whiteboard.umd.js (UMD)
 * - dist/embed/career-whiteboard.css (extracted styles; same surface as whiteboard embed)
 *
 * Hosts that need career panels load this script instead of agentable-whiteboard.js
 * plus a separate provider bootstrap.
 */
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { embedDualOutput } from './vite.embed-chunking';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'node:crypto': path.resolve(__dirname, './src/panels/document/browserNodeCryptoShim.ts'),
    },
    dedupe: [
      'tldraw',
      '@tldraw/editor',
      '@tldraw/state',
      '@tldraw/state-react',
      '@tldraw/store',
      '@tldraw/tlschema',
      '@tldraw/utils',
      '@tldraw/validate',
    ],
  },
  define: {
    // G3: shipped embed bundles never inline a provider key, whatever the
    // local .env.local carries for vite dev. The embeds' only sanctioned
    // credential source at runtime is a token-endpoint / chat proxy.
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(''),
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist/embed',
    emptyOutDir: false,
    cssCodeSplit: false,
    sourcemap: true,
    target: 'es2022',
    lib: {
      entry: path.resolve(
        __dirname,
        'packages/career-pack/src/embed/careerWhiteboardEntry.ts'),
      name: 'CareerWhiteboard',
    },
    rollupOptions: {
      // Dual ESM-chunked / UMD-single output; shared split policy in
      // vite.embed-chunking.ts.
      output: embedDualOutput({
        esFile: 'career-whiteboard.js',
        umdFile: 'career-whiteboard.umd.js',
        umdName: 'CareerWhiteboard',
        cssName: 'career-whiteboard.css',
      }),
    },
  },
});
