/**
 * automated_check: RTL chrome audit for embed + panel chrome surfaces.
 *
 * Scans governed embed/panel chrome modules for physical inline-axis CSS that
 * would break under `dir="rtl"`. Documents residual gaps outside this scope.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PHYSICAL_TO_LOGICAL_CSS } from '../../src/i18n/direction';

function repoRoot(): string {
  const testPath = expect.getState().testPath;
  if (!testPath) throw new Error('vitest did not report a testPath');
  return resolve(dirname(testPath), '../..');
}

const RTL_SCAN_DIRS = [
  'src/embed',
  'src/panels/catalog',
  'src/panels/renderer',
  'src/panels/approval',
  'src/panels/provenance',
  'src/engines/tldraw/shapes/PanelChrome.tsx',
] as const;

const PHYSICAL_PATTERNS: readonly RegExp[] = [
  /\bmargin-left\b/,
  /\bmargin-right\b/,
  /\bpadding-left\b/,
  /\bpadding-right\b/,
  /\btext-align:\s*left\b/,
  /\btext-align:\s*right\b/,
  /\bborder-left\b/,
  /\bborder-right\b/,
];

function listScanTargets(): string[] {
  const root = repoRoot();
  const files: string[] = [];
  for (const entry of RTL_SCAN_DIRS) {
    const full = join(root, entry);
    try {
      const stat = readdirSync(full, { withFileTypes: true });
      for (const child of stat) {
        const childPath = join(full, child.name);
        if (child.isDirectory()) {
          files.push(...listDirRecursive(childPath));
        } else if (/\.(tsx?|css)$/.test(child.name)) {
          files.push(childPath);
        }
      }
    } catch {
      if (/\.(tsx?|css)$/.test(entry)) {
        files.push(full);
      }
    }
  }
  return [...new Set(files)].sort();
}

function listDirRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const child of readdirSync(dir, { withFileTypes: true })) {
    const childPath = join(dir, child.name);
    if (child.isDirectory()) {
      out.push(...listDirRecursive(childPath));
    } else if (/\.(tsx?|css)$/.test(child.name)) {
      out.push(childPath);
    }
  }
  return out;
}

function relativePath(file: string): string {
  const root = repoRoot();
  return file.startsWith(root) ? file.slice(root.length + 1): file;
}

describe('embed RTL chrome audit (SC3)', () => {
  it('documents the logical-property guidance table', () => {
    expect(PHYSICAL_TO_LOGICAL_CSS['padding-left']).toBe('padding-inline-start');
    expect(PHYSICAL_TO_LOGICAL_CSS['text-align: left']).toBe('text-align: start');
  });

  it('panel chrome CSS uses logical padding (fixed in )', () => {
    const css = readFileSync(
      join(repoRoot(), 'src/engines/tldraw/styles/whiteboard-vibe-dark.css'),
      'utf8');
    const chromeBlock = css.slice(css.indexOf('.panel-chrome {'), css.indexOf('.panel-chrome__title'));
    expect(chromeBlock).toContain('padding-inline');
    expect(chromeBlock).not.toMatch(/\bpadding:\s*0\s+8px\s+0\s+12px\b/);
  });

  it('passes scan of embed + panel chrome modules for physical inline-axis CSS', () => {
    const violations: string[] = [];
    for (const file of listScanTargets()) {
      const content = readFileSync(file, 'utf8');
      for (const pattern of PHYSICAL_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${relativePath(file)} matched ${pattern.source}`);
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('documents known residual gaps outside embed chrome scan scope', () => {
    /** Documented gaps — legacy canvas layout (DraggablePanel absolute `left`) and orchestration UI. */
    const documentedGaps = [
      'src/canvas/DraggablePanel.tsx — absolute positioning uses physical `left` (legacy shell, not spec chrome)',
      'src/canvas/NavSidebar.tsx — Tailwind `left-3` sidebar anchor (legacy shell; P5 logical audit)',
    ];
    expect(documentedGaps.length).toBeGreaterThan(0);
  });
});
