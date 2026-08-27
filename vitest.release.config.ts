/// <reference types="vitest" />
/**
 * Release-gate Vitest config (`npm run test:release`).
 *
 * Runs the same suites as the base config minus the files listed in
 * `tests/release-exclusions.txt` — tests for in-progress features that do
 * not pass yet. The exclusion list may ONLY SHRINK (see its header); the
 * full suite (`npm run test`) still runs everything and is the CI signal.
 * This gate exists so a release asserts "everything shipped green" without
 * a silent blanket skip.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { configDefaults, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

const exclusions = readFileSync(path.resolve(__dirname, 'tests/release-exclusions.txt'), 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('#'));

export default mergeConfig(baseConfig, {
  test: {
    exclude: [...configDefaults.exclude, ...exclusions],
    // embedApi's beforeAll spins up a local server and sits near the default
    // 10s hook budget when the suite runs fully parallel on small runners.
    hookTimeout: 30_000,
  },
});
