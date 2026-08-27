/**
 * Bundle the multi-agent browser harness for Playwright e2e.
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
    outDir: 'dist/e2e',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    lib: {
      entry: path.resolve(__dirname, 'tests/e2e/harness/multiAgentHarness.ts'),
      name: 'MultiAgentHarness',
      formats: ['es'],
      fileName: () => 'multi-agent-harness.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
