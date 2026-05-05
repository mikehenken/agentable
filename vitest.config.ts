/// <reference types="vitest" />
/**
 * Vitest config for the OSS canvas.
 *
 * Two suites today:
 *  - tests/unit/**     — pure-function tests (CanvasContext merging,
 *                        defaultVoiceLabel, kernel snapshot stability)
 *  - tests/integration/** — happy-dom-rendered React tree assertions
 *                           (CareerCanvas + CanvasShell + VoiceWidget +
 *                           useGeminiLive end-to-end persona injection)
 *
 * Component tests for Lit (`@open-wc/testing`) live separately under
 * `tests/component/` and run via `web-test-runner` — Vitest's happy-dom
 * Shadow DOM support is incomplete for Lit, and the stricter contract
 * needs a real browser.
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx', 'tests/integration/**/*.test.ts', 'tests/integration/**/*.test.tsx'],
    // Mock voice scenarios run with real timers (350ms connecting + ~2s
    // greeting). Default 5s vitest timeout is too tight for the explicit-
    // scenario integration tests. 15s gives headroom without masking
    // genuine hangs.
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/canvas/CanvasContext.tsx',
        'src/canvas/voice/**.ts',
        'src/shared/voiceKernel.ts',
        'src/react-canvas/**.ts',
        'src/react-canvas/**.tsx',
      ],
    },
  },
});
