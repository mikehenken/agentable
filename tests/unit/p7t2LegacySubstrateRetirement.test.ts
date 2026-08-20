/**
 * automated_check: src/canvas/ gone; exactly one substrate (tldraw).
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
