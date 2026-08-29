/**
 * FUTURE-STATE SPEC — parked outside the vitest include globs on purpose.
 *
 * Asserts the deferred `src/canvas` + legacy substrate retirement (owner
 * decision 2026-08-28: retirement deferred; delete-the-fork-only shipped in
 * Wave 3). Move this file back under tests/unit/ when that decision lands.
 * Plan: career-canvas-tldraw-velvet-badger.md, Wave 5.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function srcDir(): string {
  const testPath = expect.getState().testPath;
  if (!testPath) throw new Error('vitest did not report a testPath');
  return resolve(dirname(testPath), '../../src');
}

describe(' legacy substrate retirement ', () => {
  it('has no src/canvas/ directory', () => {
    expect(existsSync(join(srcDir(), 'canvas'))).toBe(false);
  });

  it('has no layoutStore (legacy substrate state)', () => {
    expect(existsSync(join(srcDir(), 'stores', 'layoutStore.ts'))).toBe(false);
  });

  it('ships exactly one engine implementation under src/engines/', () => {
    const enginesDir = join(srcDir(), 'engines');
    const entries = readdirSync(enginesDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    expect(entries).toEqual(['tldraw']);
  });

  it('default whiteboard registry is example-only (chat)', async () => {
    const { DEFAULT_WHITEBOARD_PANEL_REGISTRY } = await import(
      '../../src/engines/tldraw/shapes/whiteboardPanelRegistry'
    );
    expect(Object.keys(DEFAULT_WHITEBOARD_PANEL_REGISTRY)).toEqual(['chat']);
  });
});
