import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';

function repoRoot(): string {
  const testPath = expect.getState().testPath;
  if (!testPath) throw new Error('vitest did not report a testPath');
  return resolve(dirname(testPath), '../..');
}

describe('check-conditional-hooks script', () => {
  it('passes on the current src tree', () => {
    const root = repoRoot();
    expect(() => {
      execFileSync(process.execPath, ['scripts/check-conditional-hooks.mjs'], {
        cwd: root,
        stdio: 'pipe',
      });
    }).not.toThrow;
  });
});
