/**
 * vite.embed-iframe-host.config.ts — sandboxed iframe host page for.
 *
 * Emits:
 * - dist/embed/iframe-host.html
 * - dist/embed/iframe-host*.js (entry + chunks)
 */
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repoRoot = __dirname;
const embedRoot = path.resolve(repoRoot, 'embed');

export default defineConfig({
  root: embedRoot,
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(repoRoot, './src'),
      '@agentable/career-pack': path.resolve(repoRoot, './packages/career-pack/src/index.ts'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: path.resolve(repoRoot, 'dist/embed'),
    emptyOutDir: false,
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      input: path.resolve(embedRoot, 'iframe-host.html'),
      output: {
        entryFileNames: 'iframe-host-[name].js',
        chunkFileNames: 'iframe-host-[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.html')) {
            return 'iframe-host.html';
          }
          return assetInfo.name ?? 'asset-[hash][extname]';
        },
      },
    },
  },
});
