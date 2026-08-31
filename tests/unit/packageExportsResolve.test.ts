/**
 * Guards package.json `exports`: every subpath resolves to a source file that
 * exists, or to a well-formed dist target whose basename is produced by an
 * in-repo vite embed config or the styles build.
 *
 * Dist artifacts may be absent on a clean-ish tree (prepare builds only canvas
 * + button). Missing dist files do not fail; present dist files must exist.
 * Mirrors the spirit of engineTypesExports / panelTypesExports: fast, no full
 * embed rebuild required.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import packageJson from '../../package.json';

type PackageExports = Record<string, string>;

function repoRoot(): string {
  const testPath = expect.getState().testPath;
  if (!testPath) throw new Error('vitest did not report a testPath');
  return resolve(dirname(testPath), '../..');
}

/** Dist basenames from vite.embed*.config.ts, vite.embed.config.ts, and build-styles.mjs. */
function collectKnownDistBasenames(root: string): Set<string> {
  const basenames = new Set<string>(['styles.css']);

  const embedConfigs = readdirSync(root).filter(
    (name) => name.startsWith('vite.embed') && name.endsWith('.config.ts'),
  );

  for (const configName of embedConfigs) {
    const text = readFileSync(join(root, configName), 'utf8');

    for (const match of text.matchAll(/fileBase:\s*['"]([^'"]+)['"]/g)) {
      const base = match[1];
      basenames.add(`${base}.js`);
      basenames.add(`${base}.umd.js`);
      basenames.add(`${base}.css`);
    }

    for (const match of text.matchAll(/esFile:\s*['"]([^'"]+)['"]/g)) {
      basenames.add(match[1]);
    }
    for (const match of text.matchAll(/umdFile:\s*['"]([^'"]+)['"]/g)) {
      basenames.add(match[1]);
    }
    for (const match of text.matchAll(/cssName:\s*['"]([^'"]+)['"]/g)) {
      basenames.add(match[1]);
    }

    // fileName ternaries in panel/app-shell configs
    for (const match of text.matchAll(/\?\s*['"]([^'"]+\.(?:js|css))['"]/g)) {
      basenames.add(match[1]);
    }
  }

  return basenames;
}

describe('package.json exports resolve', () => {
  const root = repoRoot();
  const exportsMap = packageJson.exports as PackageExports;
  const exportKeys = Object.keys(exportsMap);
  const knownDistBasenames = collectKnownDistBasenames(root);

  it('declares at least one export subpath', () => {
    expect(exportKeys.length).toBeGreaterThan(0);
  });

  it('includes ./package.json self-reference', () => {
    expect(exportsMap['./package.json']).toBe('./package.json');
  });

  for (const subpath of exportKeys) {
    it(`resolves ${subpath}`, () => {
      const target = exportsMap[subpath];
      expect(typeof target).toBe('string');
      expect(target.startsWith('./')).toBe(true);

      const absPath = resolve(root, target);

      if (target.startsWith('./src/') || target === './package.json') {
        expect(existsSync(absPath), `missing source export target: ${target}`).toBe(true);
        return;
      }

      if (target.startsWith('./dist/')) {
        const withoutDot = target.slice(2);
        expect(withoutDot.includes('..'), `dist path must not traverse up: ${target}`).toBe(
          false,
        );
        expect(withoutDot.startsWith('dist/'), `dist target must stay under dist/: ${target}`).toBe(
          true,
        );

        const distBasename = basename(target);
        expect(
          knownDistBasenames.has(distBasename),
          `dist basename "${distBasename}" is not produced by vite.embed-*.config.ts or build-styles.mjs`,
        ).toBe(true);

        if (existsSync(absPath)) {
          expect(existsSync(absPath)).toBe(true);
        }
        return;
      }

      expect.fail(`unexpected export target prefix for ${subpath}: ${target}`);
    });
  }
});
