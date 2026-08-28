/**
 * vite.embed-panel.config.ts — library-mode build for `<agentable-panel>`.
 *
 * Emits:
 * - dist/embed/agentable-panel.js (ESM)
 * - dist/embed/agentable-panel.umd.js (UMD)
 * - dist/embed/agentable-panel.css (extracted styles)
 */
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
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
    outDir: 'dist/embed',
    emptyOutDir: false,
    cssCodeSplit: false,
    sourcemap: true,
    target: 'es2022',
    lib: {
      entry: path.resolve(__dirname, 'src/embed/agentable-panel-bootstrap.ts'),
      name: 'AgentablePanel',
      formats: ['es', 'umd'],
      fileName: (format) =>
        format === 'es' ? 'agentable-panel.js': 'agentable-panel.umd.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: (assetInfo) =>
          assetInfo.name && assetInfo.name.endsWith('.css')
            ? 'agentable-panel.css': assetInfo.name || 'asset-[hash]',
      },
    },
  },
});
