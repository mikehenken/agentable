import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { WIDGET_BUNDLE_BUDGETS, WIDGET_BUNDLE_FILE_BASES } from '../../src/embed/widgets/bundleBudgets';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const distRoot = path.join(repoRoot, 'dist');

function readBudgetScript(): string {
  const scriptPath = path.join(repoRoot, 'scripts', 'check-bundle-size.mjs');
  return readFileSync(scriptPath, 'utf8');
}

describe('widget bundle budgets ', () => {
  it('declares all four widget bundle file bases', () => {
    expect(WIDGET_BUNDLE_FILE_BASES).toEqual([
      'voice-call-button',
      'agentable-starter-chip',
      'ask-about-this-button',
      'agent-status-pill',
    ]);
  });

  it('keeps TypeScript budget table aligned with check-bundle-size.mjs', () => {
    const script = readBudgetScript();
    for (const budget of WIDGET_BUNDLE_BUDGETS) {
      expect(script).toContain(`'${budget.file}'`);
      const maxKb = budget.maxBytes / 1024;
      expect(script).toMatch(new RegExp(`'${budget.file.replace(/\//g, '\\/')}', max: ${maxKb} \\* KB`));
    }
  });

  it('documents widget bundles within declared gzip budgets when built', () => {
    for (const budget of WIDGET_BUNDLE_BUDGETS) {
      const filePath = path.join(distRoot, budget.file);
      if (!existsSync(filePath)) {
         // Build artifacts may be absent in unit-only CI lanes.
        expect(filePath).toMatch(/dist[/\\]embed[/\\]/);
        continue;
      }
      const size = gzipSync(readFileSync(filePath)).length;
      expect(size).toBeLessThanOrEqual(budget.maxBytes);
    }
  });
});
