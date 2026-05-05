/**
 * vite.embed-button.config.ts — library build for the standalone
 * `<voice-call-button>` web component bundle.
 *
 * Outputs:
 *  - dist/embed/voice-call-button.js     (ESM, primary)
 *  - dist/embed/voice-call-button.umd.js (script-tag fallback)
 *
 * Designed to be loaded independently from the main `<agentable-canvas>` bundle.
 * Both bundles share the `window.__voiceKernel__` voice-state bus via runtime
 * idempotent install (see `src/shared/voiceKernel.ts`).
 */

import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist/embed',
    emptyOutDir: false,
    sourcemap: true,
    target: 'es2022',
    lib: {
      entry: path.resolve(__dirname, 'src/embed/voice-call-button.ts'),
      name: 'VoiceCallButton',
      formats: ['es', 'umd'],
      fileName: (format) =>
        format === 'es' ? 'voice-call-button.js' : 'voice-call-button.umd.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
