/**
 * Canonical./engines/tldraw public surface must not export siteContext* names
 * except explicitly deprecated aliases marked @deprecated in the barrel.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function barrelPath(): string {
  const testPath = expect.getState().testPath;
  if (!testPath) throw new Error('vitest did not report a testPath');
  return resolve(dirname(testPath), '../../src/engines/tldraw/index.tsx');
}

function canonicalExportNames(source: string): string[] {
  const names: string[] = [];
  const exportBlock =
    /export\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/gs;
  const typeExportBlock =
    /export\s+type\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/gs;

  for (const re of [exportBlock, typeExportBlock]) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(source)) !== null) {
      const block = match[1] ?? '';
      for (const part of block.split(',')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const aliasMatch = /^\s*(\w+)\s+as\s+(\w+)\s*$/.exec(trimmed);
        if (aliasMatch) {
          names.push(aliasMatch[2] ?? '');
        } else {
          const name = trimmed.replace(/^type\s+/, '').split(/\s+/)[0];
          if (name) names.push(name);
        }
      }
    }
  }

  const directExports = source.matchAll(
    /^export\s+(?:type\s+)?(?:const|function|class|interface|type)\s+(\w+)/gm);
  for (const m of directExports) {
    if (m[1]) names.push(m[1]);
  }

  return [...new Set(names)];
}

describe('engines/tldraw canonical public exports ', () => {
  it('does not expose siteContext* names outside deprecated alias block', () => {
    const source = readFileSync(barrelPath(), 'utf8');
    const deprecatedSection = source.indexOf('Deprecated one-minor aliases');
    const canonicalSection =
      deprecatedSection === -1 ? source: source.slice(0, deprecatedSection);

    const canonicalNames = canonicalExportNames(canonicalSection);
    const offenders = canonicalNames.filter((name) => /siteContext/i.test(name));

    expect(offenders).toEqual([]);
  });

  it('keeps deprecated siteContext* aliases only in the alias block', () => {
    const source = readFileSync(barrelPath(), 'utf8');
    expect(source).toContain('@deprecated Use resolveContextFrameFromSelection');
    expect(source).toContain('resolveSiteContextFromSelection');
  });
});
