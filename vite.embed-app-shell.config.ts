/**
 * vite.embed-app-shell.config.ts: library-mode build for
 * `<agentable-app-shell>`: the DOM workspace engine app-shell
 * embed. Deliberately isolated from `vite.gallery-harnesses.config.ts`
 * (which bundles multiple gallery entries, some tldraw-based, in one
 * Rollup graph) so this artifact's dependency graph is unambiguous for
 * bundle analysis: entry -> `src/embed/agentable-app-shell.ts` only,
 * never touching `../engines/tldraw/**`, the `tldraw` package, or
 * `../panels/host` (which reaches the tldraw-only digest shape collector
 * through the agent runtime).
 *
 * Emits:
 * - dist/embed/agentable-app-shell.js (ESM)
 * - dist/embed/agentable-app-shell.umd.js (UMD)
 *
 * Styles ship inline via `index.css?inline` in the Lit shell (no separate
 * CSS asset). */
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
      entry: path.resolve(__dirname, 'src/embed/agentable-app-shell.ts'),
      name: 'AgentableAppShell',
      formats: ['es', 'umd'],
      fileName: (format) =>
        format === 'es' ? 'agentable-app-shell.js': 'agentable-app-shell.umd.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: (assetInfo) =>
          assetInfo.name && assetInfo.name.endsWith('.css')
            ? 'agentable-app-shell.css': assetInfo.name || 'asset-[hash]',
      },
    },
  },
});
