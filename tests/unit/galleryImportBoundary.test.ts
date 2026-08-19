import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe(' gallery import boundary ', () => {
  it('examples/ imports only published entry points (no src/ internals)', () => {
    const result = spawnSync(process.execPath, ['scripts/check-gallery-imports.mjs'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });
});
