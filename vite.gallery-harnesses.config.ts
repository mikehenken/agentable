/**
 * Bundle gallery example harnesses for Playwright e2e.
 */
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repoRoot = path.resolve(__dirname);

export default defineConfig({
  base: '/gallery/',
  plugins: [react],
  resolve: {
    alias: {
      'agentable-canvas/react/panel': path.resolve(repoRoot, './src/react/AgentablePanel.tsx'),
      'node:crypto': path.resolve(repoRoot, './tests/e2e/harness/shims/nodeCryptoShim.ts'),
      classnames: path.resolve(repoRoot, './tests/e2e/harness/shims/classnamesShim.ts'),
      'classnames-original': path.resolve(repoRoot, './tests/e2e/harness/shims/classnamesShim.ts'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: path.resolve(repoRoot, 'dist/gallery'),
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        '06-react-host-deep': path.resolve(repoRoot, 'examples/06-react-host-deep/App.tsx'),
        '09-multi-agent-harness': path.resolve(repoRoot, 'tests/e2e/harness/multiAgentHarness.ts'),
        '12-open-agent-canvas-harness': path.resolve(
          repoRoot,
          'tests/e2e/harness/openAgentCanvasHarness.ts'),
        'p8-agent-draw-demo-harness': path.resolve(
          repoRoot,
          'tests/e2e/harness/p8AgentDrawDemoHarness.tsx'),
      },
      output: {
        entryFileNames: '[name].js',
        inlineDynamicImports: false,
      },
    },
  },
});
