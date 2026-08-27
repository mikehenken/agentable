/**
 * Host contract guard — a gallery page that mints ephemeral voice tokens must
 * also declare the text-chat proxy.
 *
 * Ephemeral tokens (`token-endpoint`) authenticate ONLY the Gemini Live
 * WebSocket API. Without `api-endpoint`, the chat client falls back to using
 * the minted token against `generateContent`, and every text message fails
 * with "Ephemeral tokens are only supported by the live API."
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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

describe('example pages — voice token pages also declare the chat proxy', () => {
  it('every page with token-endpoint also sets api-endpoint', () => {
    const root = repoRoot();
    const pages = listHtmlFiles(join(root, 'examples'));
    expect(pages.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const pagePath of pages) {
      const html = readFileSync(pagePath, 'utf8');
      if (html.includes('token-endpoint=') && !html.includes('api-endpoint=')) {
        violations.push(pagePath.slice(root.length + 1));
      }
    }

    expect(
      violations,
      `pages minting Live-only ephemeral tokens without a text-chat proxy:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});
