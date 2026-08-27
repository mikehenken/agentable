/**
 * Vite dev server for P8 agent draw + see demo (no embed build required).
 */
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repoRoot = path.resolve(__dirname);

export default defineConfig({
  base: './',
  plugins: [react()],
  root: repoRoot,
  resolve: {
    alias: {
      '@': path.resolve(repoRoot, './src'),
      classnames: path.resolve(repoRoot, './tests/e2e/harness/shims/classnamesShim.ts'),
      'classnames-original': path.resolve(repoRoot, './tests/e2e/harness/shims/classnamesShim.ts'),
      'node:crypto': path.resolve(repoRoot, './tests/e2e/harness/shims/nodeCryptoShim.ts'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'tldraw', '@tldraw/editor', 'classnames'],
  },
  server: {
    port: 3018,
    strictPort: true,
    open: '/examples/p8-agent-draw-demo/index.dev.html',
  },
});
