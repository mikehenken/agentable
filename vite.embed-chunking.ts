/**
 * vite.embed-chunking.ts: shared code-splitting policy for the tldraw-bearing
 * embeds (agentable-canvas, agentable-whiteboard, career-whiteboard,
 * agentable-operator-surface-placement).
 *
 * Each of these embeds emits TWO formats:
 *   - ESM (primary, `<script type="module">`): CODE-SPLIT. The heavy vendors
 *     that the chat/whiteboard pull in via dynamic import() (mermaid + shiki
 *     syntax + the tldraw editor) land in their own chunks under
 *     `dist/embed/chunks/`, resolved relative to the entry's `import.meta.url`,
 *     so a page that never renders a diagram / code block / whiteboard never
 *     downloads them.
 *   - UMD (script-tag fallback): single-file, dynamic imports inlined.
 *
 * One shared `splitVendorChunks` keeps the four embeds' chunk boundaries
 * identical, so a change to the policy cannot drift between them.
 */

/** Keep an embed's single extracted stylesheet name stable (hosts link it). */
export function embedAssetName(cssName: string) {
  return (assetInfo: { name?: string }): string =>
    assetInfo.name && assetInfo.name.endsWith('.css') ? cssName : assetInfo.name || 'asset-[hash]';
}

/**
 * Consolidate the heavy, lazy-capable vendors into a few named chunks instead
 * of the hundreds of micro-chunks rollup emits by default (shiki ships one
 * module per language). Grouping does NOT change eager/lazy status: a module is
 * eager only if a static import reaches it from the entry. shiki/mermaid are
 * reachable only through streamdown's dynamic import(); the tldraw editor only
 * through the whiteboard's dynamic import(). The tldraw VALUE/schema layer
 * (createShapeId, toRichText, AssetRecordType) is pulled eagerly to author
 * panels, so it is split from the editor into its own small chunk.
 */
export function splitVendorChunks(id: string): string | undefined {
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
  // The tldraw VALUE layer (schema/records/state beneath createShapeId etc.) is
  // eager; keep it out of the editor chunk so its eager pull stays small.
  if (
    /\/node_modules\/@tldraw\/(tlschema|state|state-react|store|utils|validate)\//.test(norm)
  ) {
    return 'vendor-tldraw-schema';
  }
  // The editor (tldraw, @tldraw/editor): reached only through the dynamic
  // WhiteboardShell import(), so this chunk loads lazily; a canvas page that
  // never opens the whiteboard never downloads it.
  if (/\/node_modules\/(tldraw|@tldraw)\//.test(norm)) {
    return 'vendor-tldraw';
  }
  return undefined;
}

/**
 * Dual ESM-chunked + UMD-single-file rollup `output` array for a tldraw-bearing
 * embed. The ESM build code-splits (lazy chunks under `chunks/`); the UMD build
 * stays a single inlined file for `<script>`-tag hosts.
 */
export function embedDualOutput(opts: {
  esFile: string;
  umdFile: string;
  umdName: string;
  cssName: string;
}) {
  const asset = embedAssetName(opts.cssName);
  return [
    {
      format: 'es' as const,
      entryFileNames: opts.esFile,
      chunkFileNames: 'chunks/[name]-[hash].js',
      inlineDynamicImports: false,
      manualChunks: splitVendorChunks,
      assetFileNames: asset,
    },
    {
      format: 'umd' as const,
      name: opts.umdName,
      entryFileNames: opts.umdFile,
      inlineDynamicImports: true,
      assetFileNames: asset,
    },
  ];
}
