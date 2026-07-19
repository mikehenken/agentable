/**
 * Acceptance guard for the tool registry restructure: the landi tenant
 * branch is gone from framework source and `@supabase/supabase-js` is
 * gone from both source and the package manifest.
 *
 * The tenant branch had four fingerprints: the tenant tool module
 * (`landiCanvasTools`), the tenant setter (`setCanvasToolsTenant`), the
 * tenant global (`activeTenantId`), and the allowlist constants
 * (`LANDI_CANVAS_TOOL*`). The suite walks every module under `src/` and
 * fails on any of them, so the branch cannot quietly grow back. Wider
 * client-name cleanup (`landi:` event names, `--landi-*` tokens, doc
 * comments) is the P4 rename wave and deliberately not asserted here.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

function repoRoot(): string {
  const testPath = expect.getState().testPath;
  if (!testPath) throw new Error('vitest did not report a testPath');
  return resolve(dirname(testPath), '../..');
}

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx|js|jsx|css)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files.sort();
}

const TENANT_BRANCH_FINGERPRINTS = [
  'landiCanvasTools',
  'setCanvasToolsTenant',
  'activeTenantId',
  'LANDI_CANVAS_TOOL',
] as const;

describe('tool registry tenant branch', () => {
  it('has no tenant branch fingerprints anywhere under src', () => {
    const src = join(repoRoot(), 'src');
    const offending = listSourceFiles(src).flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return TENANT_BRANCH_FINGERPRINTS.filter((fingerprint) =>
        text.includes(fingerprint),
      ).map((fingerprint) => `${relative(src, file)} -> ${fingerprint}`);
    });
    expect(offending).toEqual([]);
  });

  it('has no tenant tool module on disk', () => {
    const src = join(repoRoot(), 'src');
    const tenantModules = listSourceFiles(src).filter((file) =>
      /landi[A-Z]/.test(relative(src, file)),
    );
    expect(tenantModules).toEqual([]);
  });
});

describe('supabase removal', () => {
  it('imports no supabase package anywhere under src', () => {
    const src = join(repoRoot(), 'src');
    const offending = listSourceFiles(src).filter((file) =>
      readFileSync(file, 'utf8').includes('@supabase/'),
    );
    expect(offending).toEqual([]);
  });

  it('declares no supabase dependency in package.json', () => {
    const manifest = JSON.parse(
      readFileSync(join(repoRoot(), 'package.json'), 'utf8'),
    ) as Record<string, unknown>;
    const dependencyBlocks = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ];
    const declared = dependencyBlocks.flatMap((block) => {
      const entries = manifest[block];
      return entries && typeof entries === 'object' ? Object.keys(entries) : [];
    });
    expect(declared.filter((name) => name.startsWith('@supabase/'))).toEqual([]);
  });
});
