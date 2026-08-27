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
      formats: ['es', 'umd'],
      fileName: (format) =>
        format === 'es' ? 'career-whiteboard.js': 'career-whiteboard.umd.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: (assetInfo) =>
          assetInfo.name && assetInfo.name.endsWith('.css')
            ? 'career-whiteboard.css': assetInfo.name || 'asset-[hash]',
      },
    },
  },
});
