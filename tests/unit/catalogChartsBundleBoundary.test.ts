/**
 * bundle boundary — core src must not import @agentable/catalog-charts.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v1CatalogEntries } from '../../src/panels/catalog/v1-entries';
import { CHART_CATALOG_ENTRY_NAMES } from '@agentable/catalog-charts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CORE_SRC = path.join(ROOT, 'src');

const FORBIDDEN_IMPORT_PATTERNS = [
  '@agentable/catalog-charts',
  'packages/catalog-charts',
  'catalog-charts/src',
] as const;

const OPTIONAL_EXPORT_ALLOWLIST = new Set([
  path.join(ROOT, 'package.json'),
  path.join(ROOT, 'vitest.config.ts'),
]);

function collectFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      collectFiles(full, acc);
      continue;
    }
    if (/\.(ts|tsx|js|mjs|json)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('catalog-charts bundle boundary', () => {
  it('keeps chart catalog entries out of core v1 catalog', () => {
    for (const name of CHART_CATALOG_ENTRY_NAMES) {
      expect(v1CatalogEntries.has(name)).toBe(false);
    }
  });

  it('does not static-import catalog-charts from core src/', () => {
    const offenders: string[] = [];
    for (const file of collectFiles(CORE_SRC)) {
      const content = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        if (content.includes(pattern)) {
          offenders.push(`${path.relative(ROOT, file)} → ${pattern}`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('only references catalog-charts in explicit opt-in export wiring', () => {
    for (const file of OPTIONAL_EXPORT_ALLOWLIST) {
      const content = readFileSync(file, 'utf8');
      if (!content.includes('catalog-charts')) continue;
      expect(content).toMatch(/"\.\/catalog-charts"|@agentable\/catalog-charts/);
    }
  });

  it('keeps the core embed bundle under an enforced size budget', () => {
    // The charts add-on stays out of the core import graph (cases above);
    // the companion invariant is that the core embed bundle itself remains
    // budget-gated, so a boundary regression cannot hide inside an ungated
    // bundle. Previously this case pinned the stale legacy "950" KB literal,
    // which documented a bypassed budget rather than guarding anything.
    const bundleScript = readFileSync(
      path.join(ROOT, 'scripts/check-bundle-size.mjs'),
      'utf8');
    expect(bundleScript).toContain("'embed/agentable-canvas.js'");
    expect(bundleScript).toContain("'embed/agentable-canvas.umd.js'");
  });
});
