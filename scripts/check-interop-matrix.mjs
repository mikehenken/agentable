#!/usr/bin/env node
/**
 * interop matrix stub. Prints the smoke matrix documented in
 * docs/development/INTEROP_MATRIX.md. With --run, executes agentable-canvas
 * checks sequentially (exit non-zero on first failure).
 *
 * Usage:
 * node scripts/check-interop-matrix.mjs
 * node scripts/check-interop-matrix.mjs --run
 * node scripts/check-interop-matrix.mjs --run --strict-bundle
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const MATRIX = [
  {
    surface: ' legacy substrate retirement',
    cwd: repoRoot,
    cmd: 'npm',
    args: ['run', 'test', '--', 'tests/unit/p7t2LegacySubstrateRetirement.test.ts'],
  },
  {
    surface: 'Whiteboard panel registry',
    cwd: repoRoot,
    cmd: 'npm',
    args: ['run', 'test', '--', 'tests/unit/whiteboardPanelRegistry.test.ts'],
  },
  {
    surface: 'Career pack embed/React interop',
    cwd: repoRoot,
    cmd: 'npm',
    args: ['run', 'test', '--', 'tests/unit/careerPackInterop.test.ts'],
  },
  {
    surface: 'Engine import boundary',
    cwd: repoRoot,
    cmd: 'npm',
    args: ['run', 'test', '--', 'tests/unit/engineImportBoundary.test.ts'],
  },
  {
    surface: 'Lit agentable-whiteboard component smoke',
    cwd: repoRoot,
    cmd: 'npm',
    args: ['run', 'test:component', '--', '--files', 'tests/component/agentable-whiteboard.test.ts'],
  },
  {
    surface: 'Lit agentable-canvas component smoke',
    cwd: repoRoot,
    cmd: 'npm',
    args: ['run', 'test:component', '--', '--files', 'tests/component/agentable-canvas.test.ts'],
  },
  {
    surface: 'Embed build',
    cwd: repoRoot,
    cmd: 'npm',
    args: ['run', 'build:embed'],
  },
  {
    surface: 'Embed binding guard',
    cwd: repoRoot,
    cmd: 'npm',
    args: ['run', 'check:embed-bindings'],
  },
  {
    surface: ' gallery import guard',
    cwd: repoRoot,
    cmd: 'npm',
    args: ['run', 'check:gallery-imports'],
  },
  {
    surface: ' gallery import boundary (vitest)',
    cwd: repoRoot,
    cmd: 'npm',
    args: ['run', 'test', '--', 'tests/unit/galleryImportBoundary.test.ts'],
  },
  {
    surface: ' gallery Playwright e2e (11 examples)',
    cwd: repoRoot,
    cmd: 'npm',
    args: ['run', 'test:e2e', '--', 'tests/e2e/gallery.spec.ts'],
  },
];

const BUNDLE_CHECK = {
  surface: 'Bundle size budget (informational unless --strict-bundle)',
  cwd: repoRoot,
  cmd: 'npm',
  args: ['run', 'check:bundle'],
};

function printMatrix {
  console.log('\nInterop smoke matrix (agentable-canvas)\n');
  console.log('Doc: docs/development/INTEROP_MATRIX.md\n');
  for (const row of MATRIX) {
    console.log(` [${row.surface}]`);
    console.log(` ${row.cmd} ${row.args.join(' ')}\n`);
  }
  console.log(` [${BUNDLE_CHECK.surface}]`);
  console.log(` ${BUNDLE_CHECK.cmd} ${BUNDLE_CHECK.args.join(' ')}\n`);
  console.log('Studio reference host (manual separate repo):');
  console.log(' cd landi-canvas-studio && npm run test');
  console.log(' cd landi-canvas-studio && npm run test:e2e:mock');
  console.log(' cd landi-canvas-studio && VITE_LOCAL_AGENTABLE=1 npm run dev\n');
}

function runRow(row, { allowFail = false } = {}) {
  console.log(`\n▶ ${row.surface}`);
  const result = spawnSync(row.cmd, row.args, {
    cwd: row.cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    if (allowFail) {
      console.warn(`\n⚠ Non-fatal: ${row.surface} (see INTEROP_MATRIX.md)`);
      return;
    }
    console.error(`\n✗ Failed: ${row.surface}`);
    process.exit(result.status ?? 1);
  }
  console.log(`✓ ${row.surface}`);
}

const args = process.argv.slice(2);
const shouldRun = args.includes('--run');
const strictBundle = args.includes('--strict-bundle');

printMatrix;

if (!shouldRun) {
  console.log('Dry run only. Re-run with --run to execute checks.\n');
  process.exit(0);
}

for (const row of MATRIX) {
  runRow(row);
}

runRow(BUNDLE_CHECK, { allowFail: !strictBundle });
if (!strictBundle) {
  console.log('\nNote: check:bundle may fail on current whiteboard payload. Re-run with --strict-bundle to gate on bundle size.\n');
}

console.log('\n✓ Interop matrix checks completed.\n');
