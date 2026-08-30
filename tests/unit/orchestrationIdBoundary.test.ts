/**
 * Orchestration IDs never belong in product source. The orchestration
 * program's own identifiers (study ids like `STUDY-018`, phase/task ids
 * like `P8-T2`, and `iteration-<n>` labels) live in logs and state files,
 * never in `src/`. Leaking them into shipped code is the failure that
 * caused the 2026-08 ~800-file catastrophe this guard exists to prevent
 * (continuation plan rule C4 / Wave 7).
 *
 * The rule is stricter than "comments only": an id smuggled into a string
 * literal or identifier is just as much a leak, so this scans the raw
 * source text of every module under `src/`. Fixture cases prove the
 * scanner detects each id shape, so the guard cannot rot into a vacuous
 * green. Runs in the standard `npm run test` pipeline (a required CI job).
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

function srcDir(): string {
  const testPath = expect.getState().testPath;
  if (!testPath) throw new Error('vitest did not report a testPath');
  return resolve(dirname(testPath), '../../src');
}

function listModules(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listModules(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files.sort();
}

// Study ids (STUDY-018), phase/task ids (P8-T2), and iteration labels
// (iteration-58). Word-bounded so ordinary code (a variable, a version
// string) does not trip the phase/iteration shapes.
const ORCHESTRATION_ID_PATTERNS: readonly RegExp[] = [
  /STUDY-\d+/g,
  /\bP\d+-T\d+\b/g,
  /\biteration-\d+\b/g,
];

function orchestrationIdsIn(sourceText: string): string[] {
  const found: string[] = [];
  for (const pattern of ORCHESTRATION_ID_PATTERNS) {
    for (const match of sourceText.matchAll(pattern)) {
      found.push(match[0]);
    }
  }
  return found;
}

function collectOrchestrationIdLeaks(): string[] {
  const root = srcDir();
  return listModules(root).flatMap((file) => {
    const found = orchestrationIdsIn(readFileSync(file, 'utf8'));
    return found.map((id) => `${relative(root, file)} -> ${id}`);
  });
}

describe('src-wide orchestration-id boundary', () => {
  it('finds the modules it is guarding', () => {
    const moduleNames = listModules(srcDir()).map((file) => relative(srcDir(), file));
    expect(moduleNames).toContain(join('panels', 'host.ts'));
    expect(moduleNames).toContain(join('engines', 'tldraw', 'engine.ts'));
  });

  it('keeps every module under src/ free of orchestration ids', () => {
    expect(collectOrchestrationIdLeaks()).toEqual([]);
  });

  it('detects each orchestration-id shape rather than passing vacuously', () => {
    const fixture = [
      '// STUDY-018 continuation notes',
      "const label = 'P8-T2 draw pipeline';",
      '/* resumed from iteration-58 */',
      "import { useState } from 'react';",
      'const version = "v1-2-3";',
    ].join('\n');

    expect(orchestrationIdsIn(fixture)).toEqual(['STUDY-018', 'P8-T2', 'iteration-58']);
  });

  it('does not flag ordinary hyphenated identifiers or versions', () => {
    const clean = [
      "const cls = 'panel-2';",
      'const semver = "3-1-0";',
      "const note = 'phase two, task three';",
    ].join('\n');

    expect(orchestrationIdsIn(clean)).toEqual([]);
  });
});
