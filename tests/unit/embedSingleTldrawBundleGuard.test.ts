/**
 * Host contract guard — each example/host HTML page must load at most one
 * tldraw-bearing embed bundle (duplicate graphs → duplicate tldraw at runtime).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Self-contained embed artifacts that inline tldraw (one per page). */
export const TLDRAW_BEARING_EMBED_BUNDLES: readonly string[] = [
  'agentable-canvas.js',
  'agentable-whiteboard.js',
  'career-whiteboard.js',
] as const;

function repoRoot(): string {
  const testPath = expect.getState().testPath;
  if (!testPath) {
    throw new Error('vitest did not report a testPath');
  }
  return resolve(dirname(testPath), '../..');
}

function listHtmlFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listHtmlFiles(fullPath));
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

function countTldrawBundlesInHtml(html: string): { count: number; matches: string[] } {
  const matches: string[] = [];
  for (const bundle of TLDRAW_BEARING_EMBED_BUNDLES) {
    const pattern = new RegExp(String.raw`(?:src|href)=["'][^"']*\/embed\/${bundle.replace('.', '\\.')}["']`, 'g');
    const found = html.match(pattern);
    if (found !== null) {
      matches.push(...found.map(() => bundle));
    }
  }
  return { count: matches.length, matches };
}

function collectHostHtmlPages(root: string): string[] {
  const pages: string[] = [];
  const examplesDir = join(root, 'examples');
  pages.push(...listHtmlFiles(examplesDir));

  const websiteEmbed = join(root, '..', 'archipelago', 'website', 'public', 'embed');
  try {
    if (statSync(websiteEmbed).isDirectory()) {
      pages.push(...listHtmlFiles(websiteEmbed));
    }
  } catch {
    // website checkout optional in CI
  }

  return pages.sort();
}

describe('embed host contract — one tldraw bundle per page', () => {
  it('fails when any host HTML loads more than one tldraw-bearing bundle', () => {
    const root = repoRoot();
    const pages = collectHostHtmlPages(root);
    expect(pages.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const pagePath of pages) {
      const html = readFileSync(pagePath, 'utf8');
      const { count, matches } = countTldrawBundlesInHtml(html);
      if (count > 1) {
        const rel = pagePath.startsWith(root) ? pagePath.slice(root.length + 1): pagePath;
        violations.push(`${rel}: ${matches.join(', ')}`);
      }
    }

    expect(violations, violations.join('\n')).toEqual([]);
  });
});
