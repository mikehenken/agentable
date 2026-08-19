/**
 * Static guard: lucide-react icons used as `<Icon size={…} />` must be
 * imported in the same file. Runtime bundlers do not catch missing named
 * imports — the ReferenceError only appears when that JSX branch renders.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const SKIP_COMPONENTS = new Set([
  'PersonaHalo',
  'StarterChips',
  'PromptInput',
  'Reasoning',
  'Streamdown',
  'DraggablePanel',
  'IconButton',
  'CopyButton',
  'Icon', // dynamic lucide component from config/state
]);

function repoRoot(): string {
  const testPath = expect.getState().testPath;
  if (!testPath) throw new Error('vitest did not report a testPath');
  return resolve(dirname(testPath), '../..');
}

function listTsx(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory && entry.name !== 'node_modules') {
      files.push(...listTsx(full));
    } else if (/\.tsx$/.test(entry.name) && !/\.(test|spec)\.tsx$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files.sort();
}

function lucideImports(source: string): Set<string> {
  const match = source.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/);
  const imported = new Set<string>();
  if (!match) return imported;
  for (const part of match[1].split(',')) {
    const name = part.trim().split(/\s+as\s+/)[0]?.trim();
    if (name) imported.add(name);
  }
  return imported;
}

function jsxSizeIcons(source: string): string[] {
  return [...source.matchAll(/<([A-Z][a-zA-Z0-9]*)\s+size=/g)].map((m) => m[1]);
}

describe('lucide-react icon imports', () => {
  it('every `<Icon size={…} />` usage in src/**/*.tsx is imported from lucide-react', () => {
    const root = repoRoot();
    const srcDir = join(root, 'src');
    const violations: string[] = [];

    for (const file of listTsx(srcDir)) {
      const source = readFileSync(file, 'utf8');
      const imported = lucideImports(source);
      for (const icon of jsxSizeIcons(source)) {
        if (SKIP_COMPONENTS.has(icon)) continue;
        if (!imported.has(icon)) {
          violations.push(`${file.replace(root + '\\', '').replace(root + '/', '')}: missing import for ${icon}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
