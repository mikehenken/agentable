/**
 * vite.embed-whiteboard.config.ts — library-mode build for the
 * `<agentable-whiteboard>` web component (WhiteboardShell tldraw).
 *
 * Emits:
 * - dist/embed/agentable-whiteboard.js (ESM)
 * - dist/embed/agentable-whiteboard.umd.js (UMD script-tag fallback)
 * - dist/embed/agentable-whiteboard.css (extracted styles)
 *
 * Kept separate from the CanvasShell embed so hosts that only need the
 * legacy absolute-position canvas are not penalized by the tldraw payload.
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
    /* Mixed umbrella (`tldraw`) and sub-package (`@tldraw/*`) imports across
     the engine resolve to the same physical package from different
     dependency paths in this workspace; without dedupe, Vite/Rollup can
     bundle two separate tldraw module instances, breaking the editor's
     module-singleton state (signals store, shape registries) at runtime. */
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
      entry: path.resolve(__dirname, 'src/embed/agentable-whiteboard.ts'),
      name: 'AgentableWhiteboard',
      formats: ['es', 'umd'],
      fileName: (format) =>
        format === 'es' ? 'agentable-whiteboard.js' : 'agentable-whiteboard.umd.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: (assetInfo) =>
          assetInfo.name && assetInfo.name.endsWith('.css')
            ? 'agentable-whiteboard.css' : assetInfo.name || 'asset-[hash]',
      },
    },
  },
});
