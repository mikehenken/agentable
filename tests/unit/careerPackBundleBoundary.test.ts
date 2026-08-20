/**
 * bundle boundary — core src must not import career-pack (except allowlisted debt).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CORE_SRC = path.join(ROOT, 'src');

const FORBIDDEN_IMPORT_PATTERNS = [
  '@agentable/career-pack',
  'packages/career-pack',
  'career-pack/src',
] as const;

/** Pre-existing violations — allowlist only shrinks; no new entries. */
const ALLOWLISTED_CORE_FILES = new Set<string>([
  'src/embed/panel/resolveEmbedPanelHost.ts',
  'src/config/panelDataCoalesce.ts',
  'src/embed/panel/useEmbedReactPanelData.ts',
  'src/embed/appShell/AppShellWorkspace.tsx',
]);

const ALLOWLIST_REMOVAL_CONDITIONS: Readonly<Record<string, string>> = {
  'src/embed/panel/resolveEmbedPanelHost.ts':
    'EmbedPanelPackPlugin seam lands; example 04 + panel embed re-verified without direct pack import.',
  'src/config/panelDataCoalesce.ts':
    'Panel data coalesce delegates to pack-registered adapter plugins; career + support-inbox packs register handlers.',
  'src/embed/panel/useEmbedReactPanelData.ts':
    'Open Positions data hook moves to career-pack; embed panel shell resolves adapter via plugin registry.',
  'src/embed/appShell/AppShellWorkspace.tsx':
    'App shell workspace loads panels via pack plugin registration; example 11 re-verified.',
};

function collectFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      collectFiles(full, acc);
      continue;
    }
    if (/\.(ts|tsx|js|mjs)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

function isAllowlisted(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  return ALLOWLISTED_CORE_FILES.has(normalized);
}

describe('career-pack bundle boundary', () => {
  it('does not static-import career-pack from core src/ (except allowlist)', () => {
    const offenders: string[] = [];
    for (const file of collectFiles(CORE_SRC)) {
      const relative = path.relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        if (!content.includes(pattern)) continue;
        if (isAllowlisted(relative)) continue;
        offenders.push(`${relative} → ${pattern}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('documents allowlisted violations with removal conditions', () => {
    expect(ALLOWLISTED_CORE_FILES.size).toBe(4);
    for (const file of ALLOWLISTED_CORE_FILES) {
      const condition = ALLOWLIST_REMOVAL_CONDITIONS[file];
      expect(condition, file).toBeDefined();
      expect(condition.length).toBeGreaterThan(20);
      const content = readFileSync(path.join(ROOT, file), 'utf8');
      const hasForbidden = FORBIDDEN_IMPORT_PATTERNS.some((pattern) => content.includes(pattern));
      expect(hasForbidden, file).toBe(true);
    }
  });

  it('fails when a deliberate non-allowlisted violation is present', () => {
    const probe = 'packages/career-pack/src/whiteboard';
    const offenders: string[] = [];
    for (const file of collectFiles(CORE_SRC)) {
      const relative = path.relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      if (content.includes(probe) && !isAllowlisted(relative)) {
        offenders.push(relative);
      }
    }
    expect(offenders).toEqual([]);
  });
});
