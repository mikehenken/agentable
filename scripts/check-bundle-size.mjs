#!/usr/bin/env node
/**
 * Enforces bundle-size budgets per the Career Concierge Canvas milestones
 * doc. Runs after `vite build` for both embed bundles. Exits non-zero on
 * bust.
 *
 * Budgets (gzipped) — calibrated 2026-04-25 against the M1 baseline:
 *   agentable-canvas.js              ESM ≤ 280 KB  (ships React + ReactDOM
 *                                                   + framer-motion + Lit
 *                                                   + 12 panels; non-React
 *                                                   hosts can't externalize)
 *   agentable-canvas.umd.js          UMD ≤ 230 KB  (UMD has tighter tree-
 *                                                   shaking than ESM here
 *                                                   due to module shape)
 *   voice-call-button.js       ESM ≤ 40 KB        (Lit only, no React)
 *   voice-call-button.umd.js   UMD ≤ 60 KB
 *
 * Future work — code-split heavy panels (Settings/Applications/Resources)
 * via `React.lazy` to drop initial-paint payload below 200 KB. Tracked
 * under Track A.3 follow-up. Not gating M1; the 280 KB Lit-shell bundle
 * is acceptable for first-mount given React is mandatory for non-React
 * hosts. React-canvas (mode C) doesn't go through this build at all.
 */

import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist', 'embed');

const KB = 1024;
const distRoot = path.resolve(__dirname, '..', 'dist');
const BUDGETS = [
  { file: 'embed/agentable-canvas.js', max: 280 * KB, label: 'ESM' },
  { file: 'embed/agentable-canvas.umd.js', max: 230 * KB, label: 'UMD' },
  { file: 'embed/voice-call-button.js', max: 40 * KB, label: 'ESM' },
  { file: 'embed/voice-call-button.umd.js', max: 60 * KB, label: 'UMD' },
  // dist/styles.css is the pre-built Tailwind for React-canvas consumers.
  // Compare gzipped to match the JS bundles' yardstick. ~14-18KB is normal
  // for a 12-panel canvas surface; 30KB ceiling catches Tailwind drift
  // (e.g. accidentally enabling the full color palette).
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
      results.push({
        ...budget,
        status: 'missing',
        size: 0,
      });
      continue;
    }
    const size = await gzippedSize(filePath);
    const overBudget = size > budget.max;
    if (overBudget) failed = true;
    results.push({
      ...budget,
      status: overBudget ? 'over' : 'ok',
      size,
    });
  }

  console.log('\nBundle size budget check (gzipped)');
  console.log('───────────────────────────────────────────────────');
  for (const r of results) {
    if (r.status === 'missing') {
      console.log(`  ⚠  ${r.file}: not built — skipped (run vite build first)`);
      continue;
    }
    const icon = r.status === 'ok' ? '✓' : '✗';
    const ratio = ((r.size / r.max) * 100).toFixed(1);
    console.log(
      `  ${icon}  ${r.file.padEnd(36)} ${formatKB(r.size).padStart(10)}  /  ${formatKB(r.max).padStart(10)}  (${ratio}%)`
    );
  }
  console.log('───────────────────────────────────────────────────\n');

  if (failed) {
    console.error('✗ Bundle size budget exceeded. See report above.');
    process.exit(1);
  }
  console.log('✓ All bundles within budget.');
}

main().catch((err) => {
  console.error('check-bundle-size failed:', err);
  process.exit(2);
});
