/**
 * @web/test-runner config for Lit component tests in a real browser.
 *
 * This is the harness mandated by `web-components-ui.md` §9.2: every
 * `@customElement`-decorated class MUST have a dedicated component test
 * file that mounts the real custom element in a real browser and asserts
 * against the Shadow DOM tree (not the light DOM). JSDOM/happy-dom's
 * Shadow-DOM support is incomplete and silently diverges from browser
 * behavior — those substitutes don't count.
 *
 * Vitest stays as-is for pure-React unit + integration tests (the
 * 51-test suite at `tests/unit/` and `tests/integration/`). This config
 * only governs `tests/component/*.test.ts` — the Lit-element layer.
 *
 * To run:
 *   npm install        # pulls @open-wc/testing, @web/test-runner,
 *                      # @web/test-runner-playwright, playwright
 *   npx playwright install chromium    # one-time browser bin download
 *   npm run test:component
 */
import { playwrightLauncher } from '@web/test-runner-playwright';
import { fromRollup } from '@web/dev-server-rollup';
import { esbuildPlugin } from '@web/dev-server-esbuild';
import rollupReplace from '@rollup/plugin-replace';
import rollupCommonjs from '@rollup/plugin-commonjs';

const replace = fromRollup(rollupReplace);
const commonjs = fromRollup(rollupCommonjs);

export default {
  // Serve from workspace root so workspace-hoisted node_modules (React,
  // react-dom, etc.) live INSIDE the dev-server's serve root. Without this,
  // the dev server falls back to its `__wds-outside-root__` handler for
  // hoisted deps, which BYPASSES the plugin chain — meaning nodeResolve
  // exportConditions and rollup-commonjs never get applied to React, and
  // the browser receives raw CJS that lacks an ESM `default` export. See
  // docs/reviews/2026-04-26-F73-activation-attempt.md §5 for the full
  // root-cause writeup.
  rootDir: '../',
  files: ['tests/component/**/*.test.ts'],

  // Real browser per `web-components-ui.md` §9.2. Chromium is the default
  // gate; CI release pipelines should expand to the WebKit + Firefox
  // matrix. Local dev runs Chromium-only for speed.
  browsers: [
    playwrightLauncher({ product: 'chromium' }),
    // playwrightLauncher({ product: 'webkit' }),
    // playwrightLauncher({ product: 'firefox' }),
  ],

  // ESM entry — Lit + the embed entry use top-level `import` syntax.
  // Explicit `exportConditions` forces the dev server to pick React's
  // ESM entry (`react/index.mjs` with `export default`) over the CJS
  // `react/index.js` shim that lacks default export. Without this,
  // shadcn `import * as React from 'react'` chains fail to load with
  // "module does not provide an export named 'default'".
  nodeResolve: {
    exportConditions: ['module', 'import', 'browser', 'default'],
  },

  // TypeScript + JSX/TSX transform. Explicit plugin instantiation rather
  // than the top-level `esbuildTarget` shortcut, because the shortcut and
  // a custom `plugins: [...]` array don't compose reliably in
  // @web/test-runner — the explicit plugin form ensures TS files in the
  // test tree (and the Lit-element source they import) get compiled to
  // browser-runnable JS before the dev server serves them.
  plugins: [
    // tsconfig: 'tsconfig.app.json' so esbuild picks up
    // `experimentalDecorators: true` — Lit's @customElement / @property
    // decorators fail to parse without it.
    // CJS→ESM synthesis for React 19 (CJS-shape) and other CJS deps.
    // Without this, `import * as React from 'react'` and `import React`
    // resolve to a CJS module that has no ESM `default` export, and the
    // dev server returns the raw CJS to the browser which fails.
    // Limited to .js to avoid clobbering esbuild's TS handling.
    commonjs({
      include: [/node_modules/],
    }),
    esbuildPlugin({
      ts: true,
      tsx: true,
      jsx: 'automatic',
      jsxImportSource: 'react',
      target: 'auto',
      tsconfig: 'tsconfig.app.json',
    }),
    // CSS stub — `agentable-canvas.ts` imports `../index.css` for runtime
    // styling; the test-runner dev server has no CSS handler, so the
    // import 404s and the entire module-load chain fails. Style assertions
    // are out of scope for component tests (those run in production-builds
    // via Tailwind/Vite). Return a no-op module for any .css request.
    {
      name: 'css-stub',
      serve(context) {
        if (context.path.endsWith('.css')) {
          return { body: 'export default "";', type: 'js' };
        }
      },
    },
    replace({
      preventAssignment: true,
      'import.meta.env.MODE': JSON.stringify('test'),
      'import.meta.env.NODE_ENV': JSON.stringify('test'),
      'import.meta.env.DEV': JSON.stringify(false),
      'import.meta.env.PROD': JSON.stringify(false),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(''),
      'import.meta.env.VITE_LANDI_MOCK': JSON.stringify('1'),
    }),
  ],
  // Note: removed top-level `esbuildTarget: 'auto'`; the explicit
  // esbuildPlugin in `plugins` above is now the single source of truth
  // for TS/JSX transform.

  // Coverage gate per web-components-ui.md §9.6.
  coverage: false, // Enable in CI: { threshold: { statements: 85, branches: 80 } }

  testFramework: {
    config: {
      timeout: '4000',
    },
  },
};
