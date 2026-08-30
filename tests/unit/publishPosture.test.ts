/**
 * Wave 6 publish posture guard.
 *
 * Asserts the npm package ships the right thing to the right place:
 *  - scoped public name on the public registry (not the old unscoped GH-Packages config),
 *  - no gallery/site/e2e build output leaking into the tarball,
 *  - no dead subpath exports (targets that were deleted),
 *  - a packed-size ceiling that ratchets DOWN (Wave 8 lazy tldraw lowers it further).
 *
 * The tarball assertions run `npm pack --dry-run --json`, which honours the
 * `files` field + on-disk state, so this catches a regression the moment the
 * negations or exports drift.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'));

// Ratchet: measured 29.4 MB packed at v0.4.0 (ship-source + inlined-tldraw embeds).
// This ceiling may only SHRINK. Wave 8 (lazy tldraw) is expected to drop it hard.
const PACKED_SIZE_CEILING_BYTES = 35 * 1024 * 1024;

describe('publish posture', () => {
  it('publishes the scoped package to the public npm registry', () => {
    expect(pkg.name).toBe('@mikehenken/agentable-canvas');
    expect(pkg.publishConfig?.registry).toBe('https://registry.npmjs.org');
    expect(pkg.publishConfig?.access).toBe('public');
  });

  it('excludes gallery/site/e2e build output from the files field', () => {
    for (const neg of ['!dist/site', '!dist/gallery', '!dist/e2e']) {
      expect(pkg.files).toContain(neg);
    }
  });

  it('exposes no dead subpath exports (deleted orchestration targets)', () => {
    expect(pkg.exports).not.toHaveProperty('./orchestration');
    expect(pkg.exports).not.toHaveProperty('./orchestration/tokens.css');
  });

  it('packs no site/gallery/e2e entries and stays under the size ceiling', () => {
    const raw = execFileSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      maxBuffer: 32 * 1024 * 1024,
    });
    const meta = JSON.parse(raw)[0];

    expect(meta.name).toBe('@mikehenken/agentable-canvas');

    const leaked = meta.files
      .map((f: { path: string }) => f.path)
      .filter((p: string) => /^dist[\\/](site|gallery|e2e)[\\/]/.test(p));
    expect(leaked).toEqual([]);

    expect(meta.size).toBeLessThanOrEqual(PACKED_SIZE_CEILING_BYTES);
  }, 60_000);
});
