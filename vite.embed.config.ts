/**
 * vite.embed.config.ts — library-mode build for the embeddable
 * `<agentable-canvas>` web component.
 *
 * Emits TWO formats:
 *   - `dist/embed/agentable-canvas.js`     ESM (primary — for React 19 hosts
 *                                          that `import 'agentable-canvas/embed'`)
 *   - `dist/embed/agentable-canvas.umd.js` UMD (script-tag fallback for
 *                                          non-React hosts)
 *
 * Both formats self-register the `<agentable-canvas>` custom element and
 * bundle React + Tailwind + all canvas logic. Side-effect import in a React
 * module (preferred), or one script tag for vanilla / Vue / Angular hosts.
 *
 * Kept separate from `vite.config.ts` (the standalone app build) so the two
 * outputs don't collide.
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
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist/embed',
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: true,
    target: 'es2022',
    lib: {
      entry: path.resolve(__dirname, 'src/embed/agentable-canvas.ts'),
      name: 'AgentableCanvas',
      formats: ['es', 'umd'],
      fileName: (format) =>
        format === 'es' ? 'agentable-canvas.js' : 'agentable-canvas.umd.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: (assetInfo) =>
          assetInfo.name && assetInfo.name.endsWith('.css')
            ? 'agentable-canvas.css'
            : assetInfo.name || 'asset-[hash]',
      },
    },
  },
});
