#!/usr/bin/env node
/**
 * Enforces gzip bundle-size budgets. Runs after the vite embed builds and
 * exits non-zero on any bust.
 *
 * Two kinds of entries:
 *
 *   - Widget budgets: mirrored verbatim from
 *     `src/embed/widgets/bundleBudgets.ts` (unit-tested alignment in
 *     tests/unit/widgetBundleBudgets.test.ts). These are real design budgets.
 *
 *   - RATCHET budgets: measured actual +10%, recalibrated 2026-08-28 against
 *     a clean `build:embed:site` on main @ dbbec37. These are NOT targets;
 *     they are ceilings that stop unnoticed growth while the lazy-tldraw
 *     architecture wave brings the tldraw-bearing entries down to real
 *     budgets (<= 100 KB entry chunks). A RATCHET value may only move DOWN.
 *
 * Missing files are skipped with a warning by default (the `prepare` hook
 * path builds only the canvas + button bundles). Set
 * CHECK_BUNDLE_REQUIRE_ALL=1 (the CI bundle-budgets job does) to turn a
 * missing file into a failure, so the gate cannot pass by not building.
 */

import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const KB = 1024;
const distRoot = path.resolve(__dirname, '..', 'dist');
const requireAll = process.env.CHECK_BUNDLE_REQUIRE_ALL === '1';

const BUDGETS = [
  // ── tldraw-bearing embeds (RATCHET: measured 2026-08-28 +10%) ──────────
  { file: 'embed/agentable-canvas.js', max: 4260 * KB, label: 'ESM' }, // RATCHET, measured 3866 KB
  { file: 'embed/agentable-canvas.umd.js', max: 3790 * KB, label: 'UMD' }, // RATCHET, measured 3438 KB
  { file: 'embed/agentable-whiteboard.js', max: 4630 * KB, label: 'ESM' }, // RATCHET, measured 4208 KB
  { file: 'embed/agentable-whiteboard.umd.js', max: 4130 * KB, label: 'UMD' }, // RATCHET, measured 3749 KB
  { file: 'embed/career-whiteboard.js', max: 4690 * KB, label: 'ESM' }, // RATCHET, measured 4257 KB
  { file: 'embed/career-whiteboard.umd.js', max: 4180 * KB, label: 'UMD' }, // RATCHET, measured 3793 KB
  { file: 'embed/agentable-operator-surface-placement.js', max: 4200 * KB, label: 'ESM' }, // RATCHET, measured 3818 KB
  { file: 'embed/agentable-operator-surface-placement.umd.js', max: 3750 * KB, label: 'UMD' }, // RATCHET, measured 3403 KB

  // ── embed stylesheets (RATCHET: tldraw fonts/assets are inlined today; ──
  // ── the lazy-tldraw wave externalizes them and these ratchet down)     ──
  { file: 'embed/agentable-canvas.css', max: 1020 * KB, label: 'CSS' }, // RATCHET, measured 923 KB
  { file: 'embed/agentable-whiteboard.css', max: 1040 * KB, label: 'CSS' }, // RATCHET, measured 941 KB
  { file: 'embed/career-whiteboard.css', max: 1040 * KB, label: 'CSS' }, // RATCHET, measured 941 KB
  { file: 'embed/agentable-operator-surface-placement.css', max: 1040 * KB, label: 'CSS' }, // RATCHET, measured 940 KB

  // ── mid-size embeds (RATCHET) ───────────────────────────────────────────
  { file: 'embed/agentable-panel.js', max: 920 * KB, label: 'ESM' }, // RATCHET, measured 834 KB
  { file: 'embed/agentable-panel.umd.js', max: 720 * KB, label: 'UMD' }, // RATCHET, measured 653 KB
  { file: 'embed/iframe-host-PanelEmbedShell.js', max: 570 * KB, label: 'ESM' }, // RATCHET, measured 517 KB
  { file: 'embed/agentable-app-shell.js', max: 225 * KB, label: 'ESM' }, // RATCHET, measured 203 KB
  { file: 'embed/agentable-app-shell.umd.js', max: 190 * KB, label: 'UMD' }, // RATCHET, measured 171 KB
  { file: 'embed/agentable-gallery-13-chrome.js', max: 115 * KB, label: 'ESM' }, // RATCHET, measured 103 KB
  { file: 'embed/agentable-gallery-13-chrome.umd.js', max: 95 * KB, label: 'UMD' }, // RATCHET, measured 82 KB
  { file: 'embed/agentable-gallery-13-chrome.css', max: 20 * KB, label: 'CSS' }, // RATCHET, measured 17 KB

  // ── widget budgets (mirror of src/embed/widgets/bundleBudgets.ts) ──────
  { file: 'embed/voice-call-button.js', max: 40 * KB, label: 'ESM' },
  { file: 'embed/voice-call-button.umd.js', max: 60 * KB, label: 'UMD' },
  { file: 'embed/agentable-starter-chip.js', max: 28 * KB, label: 'ESM' },
  { file: 'embed/agentable-starter-chip.umd.js', max: 40 * KB, label: 'UMD' },
  { file: 'embed/ask-about-this-button.js', max: 28 * KB, label: 'ESM' },
  { file: 'embed/ask-about-this-button.umd.js', max: 40 * KB, label: 'UMD' },
  { file: 'embed/agent-status-pill.js', max: 28 * KB, label: 'ESM' },
  { file: 'embed/agent-status-pill.umd.js', max: 40 * KB, label: 'UMD' },

  // dist/styles.css is the pre-built Tailwind for React-canvas consumers.
  // ~14-18 KB is normal for a 12-panel canvas surface; 30 KB catches
  // Tailwind drift (e.g. accidentally enabling the full color palette).
  { file: 'styles.css', max: 30 * KB, label: 'CSS' },
];

async function gzippedSize(filePath) {
  const buf = await readFile(filePath);
  return gzipSync(buf).length;
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatKB(bytes) {
  return `${(bytes / KB).toFixed(2)} KB`;
}

async function main() {
  const results = [];
  let failed = false;

  for (const budget of BUDGETS) {
    const filePath = path.join(distRoot, budget.file);
    if (!(await fileExists(filePath))) {
      if (requireAll) failed = true;
      results.push({ ...budget, status: 'missing', size: 0 });
      continue;
    }
    const size = await gzippedSize(filePath);
    const overBudget = size > budget.max;
    if (overBudget) failed = true;
    results.push({ ...budget, status: overBudget ? 'over' : 'ok', size });
  }

  console.log('\nBundle size budget check (gzipped)');
  console.log('───────────────────────────────────────────────────');
  for (const r of results) {
    if (r.status === 'missing') {
      const icon = requireAll ? '✗' : '⚠';
      console.log(
        `  ${icon}  ${r.file}: not built — ${requireAll ? 'REQUIRED (CHECK_BUNDLE_REQUIRE_ALL=1)' : 'skipped (run vite build first)'}`
      );
      continue;
    }
    const icon = r.status === 'ok' ? '✓' : '✗';
    const ratio = ((r.size / r.max) * 100).toFixed(1);
    console.log(
      `  ${icon}  ${r.file.padEnd(52)} ${formatKB(r.size).padStart(11)}  /  ${formatKB(r.max).padStart(11)}  (${ratio}%)`
    );
  }
  console.log('───────────────────────────────────────────────────\n');

  if (failed) {
    console.error('✗ Bundle size budget check failed. See report above.');
    process.exit(1);
  }
  console.log('✓ All bundles within budget.');
}

main().catch((err) => {
  console.error('check-bundle-size failed:', err);
  process.exit(2);
});
