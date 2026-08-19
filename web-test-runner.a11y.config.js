/**
 * @web/test-runner config — axe a11y smoke gate only (P10-T6).
 *
 * Runs `tests/component/a11y.test.ts` in isolation for release conformance.
 * Full component matrix remains on `web-test-runner.config.js`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwrightLauncher } from '@web/test-runner-playwright';
import { fromRollup } from '@web/dev-server-rollup';
import { esbuildPlugin } from '@web/dev-server-esbuild';
import rollupReplace from '@rollup/plugin-replace';
import rollupCommonjs from '@rollup/plugin-commonjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const axeCorePath = path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js');
const axeCoreBody = fs.readFileSync(axeCorePath, 'utf8');

const replace = fromRollup(rollupReplace);
const commonjs = fromRollup(rollupCommonjs);

export default {
  rootDir: '../',
  files: ['tests/component/a11y.test.ts'],
  browsers: [playwrightLauncher({ product: 'chromium' })],
  nodeResolve: {
    exportConditions: ['module', 'import', 'browser', 'default'],
  },
  plugins: [
    commonjs({ include: [/node_modules/] }),
    esbuildPlugin({
      ts: true,
      tsx: true,
      jsx: 'automatic',
      jsxImportSource: 'react',
      target: 'auto',
      tsconfig: 'tsconfig.app.json',
    }),
    {
      name: 'axe-core-serve',
      serve(context) {
        const normalized = context.path.replace(/\\/g, '/');
        if (normalized.includes('axe-core/axe.min.js')) {
          return {
            body: `${axeCoreBody}\nexport default globalThis.axe;`,
            type: 'js',
          };
        }
      },
    },
    {
      name: 'css-stub',
      serve(context) {
        if (context.path.includes('.css')) {
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
  testFramework: {
    config: {
      timeout: '8000',
    },
  },
};
