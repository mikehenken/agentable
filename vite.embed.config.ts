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
import { embedDualOutput } from './vite.embed-chunking';

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
      // Dual ESM-chunked / UMD-single output; see vite.embed-chunking.ts for
      // the shared split policy used by all four tldraw-bearing embeds.
      output: embedDualOutput({
        esFile: 'agentable-canvas.js',
        umdFile: 'agentable-canvas.umd.js',
        umdName: 'AgentableCanvas',
        cssName: 'agentable-canvas.css',
      }),
    },
  },
});
