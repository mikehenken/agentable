import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function runGuard(env: Record<string, string> = {}) {
  return spawnSync(process.execPath, ['scripts/check-gallery-imports.mjs'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

describe('gallery import boundary', () => {
  it('examples/ imports only published entry points (no src/ internals)', () => {
    const result = runGuard();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  describe('detects violations rather than passing vacuously', () => {
    let fixtureRoot: string;

    beforeAll(() => {
      fixtureRoot = mkdtempSync(path.join(tmpdir(), 'gallery-guard-'));
      const exampleDir = path.join(fixtureRoot, 'bad-example');
      mkdirSync(exampleDir, { recursive: true });
      writeFileSync(
        path.join(exampleDir, 'app.ts'),
        "import { host } from '../../src/panels/host';\n",
      );
      writeFileSync(
        path.join(exampleDir, 'index.html'),
        '<script type="module" src="/tests/e2e/harness/thing.tsx"></script>\n',
      );
      writeFileSync(
        path.join(exampleDir, 'skipped.dev.html'),
        '<script type="module" src="/tests/e2e/harness/dev-only.tsx"></script>\n',
      );
    });

    afterAll(() => {
      rmSync(fixtureRoot, { recursive: true, force: true });
    });

    it('fails on a src-reaching import and a /tests/ script tag, skipping *.dev.html', () => {
      const result = runGuard({ GALLERY_GUARD_EXAMPLES_ROOT: fixtureRoot });
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(1);
      expect(result.stderr).toContain('bad-example/app.ts');
      expect(result.stderr).toContain('/tests/e2e/harness/thing.tsx');
      expect(result.stderr).not.toContain('dev-only.tsx');
    });
  });
});
