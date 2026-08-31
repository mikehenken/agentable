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
 * module (preferred), or one script tag for vanilla Vue Angular hosts.
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
    // G3: shipped embed bundles never inline a provider key, whatever the
    // local .env.local carries for vite dev. The embeds' only sanctioned
    // credential source at runtime is a token-endpoint / chat proxy.
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(''),
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
    },
    rollupOptions: {
      // Two outputs from one graph:
      //   - ESM (primary, `<script type="module">`): CODE-SPLIT. The heavy
      //     lazy-loaded vendors (mermaid + shiki syntax + tldraw editor) that
      //     the chat/whiteboard pull in via dynamic import() land in their own
      //     chunks under `dist/embed/chunks/`, resolved relative to the entry's
      //     `import.meta.url`, so a page that never renders a diagram / code
      //     block / whiteboard never downloads them.
      //   - UMD (script-tag fallback): single-file, dynamic imports inlined.
      output: [
        {
          format: 'es',
          entryFileNames: 'agentable-canvas.js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          inlineDynamicImports: false,
          manualChunks: splitVendorChunks,
          assetFileNames: embedAssetName,
        },
        {
          format: 'umd',
          name: 'AgentableCanvas',
          entryFileNames: 'agentable-canvas.umd.js',
          inlineDynamicImports: true,
          assetFileNames: embedAssetName,
        },
      ],
    },
  },
});

/** Keep the single embed stylesheet name stable (hosts link `agentable-canvas.css`). */
function embedAssetName(assetInfo: { name?: string }): string {
  return assetInfo.name && assetInfo.name.endsWith('.css')
    ? 'agentable-canvas.css'
    : assetInfo.name || 'asset-[hash]';
}

/**
 * Consolidate the heavy, lazy-only vendors into a few named chunks instead of
 * the hundreds of micro-chunks rollup emits by default (shiki ships one module
 * per language). These are reachable ONLY through dynamic import() (streamdown
 * lazy-loads mermaid/shiki, the whiteboard lazy-loads tldraw), so grouping them
 * does not pull them into the eager entry.
 */
function splitVendorChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  const norm = id.replace(/\\/g, '/');
  if (/\/node_modules\/(shiki|@shikijs|vscode-oniguruma|vscode-textmate)\//.test(norm)) {
    return 'vendor-syntax';
  }
  if (
    /\/node_modules\/(mermaid|cytoscape|cytoscape-[^/]+|dagre-d3-es|dagre|elkjs|khroma|@braintree\/sanitize-url|dompurify|d3-[^/]+|d3|@mermaid-js)\//.test(
      norm,
    )
  ) {
    return 'vendor-diagrams';
  }
  // The tldraw VALUE layer (createShapeId, AssetRecordType, toRichText and the
  // record/schema runtime beneath them) is pulled EAGERLY by the canvas to open
  // panels. Keep it in its own small chunk so that eager pull does not drag the
  // heavy editor. tlschema and its non-editor runtime deps never import the
  // editor, so this chunk stays editor-free.
  if (
    /\/node_modules\/@tldraw\/(tlschema|state|state-react|store|utils|validate)\//.test(norm)
  ) {
    return 'vendor-tldraw-schema';
  }
  // The editor itself (tldraw, @tldraw/editor) is reached only through the
  // dynamic WhiteboardShell import(), so this chunk loads lazily; a canvas page
  // that never opens the whiteboard never downloads it.
  if (/\/node_modules\/(tldraw|@tldraw)\//.test(norm)) {
    return 'vendor-tldraw';
  }
  return undefined;
}
