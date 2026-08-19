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
  plugins: [react],
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
