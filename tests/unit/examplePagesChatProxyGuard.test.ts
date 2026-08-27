/**
 * Host contract guard — a gallery page that mints ephemeral voice tokens must
 * also route text chat through the same-origin proxy.
 *
 * Ephemeral tokens (`token-endpoint`) authenticate ONLY the Gemini Live
 * WebSocket API. Without a chat proxy, the chat client falls back to spending
 * the minted token on `generateContent`, and every text message fails with
 * "Ephemeral tokens are only supported by the live API."
 *
 * Two layers must agree, and each check below caught a real production break:
 * - the `api-endpoint` attribute feeds the operator/Atlas chat resolver
 *   (src/chat/whiteboardChatCredentials.ts);
 * - `persona.chatProxyUrl` in the page's config document feeds ChatPanel,
 *   which reads persona + build env and never sees host attributes.
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

function tokenEndpointPages(root: string): { page: string; html: string }[] {
  return listHtmlFiles(join(root, 'examples'))
    .map((page) => ({ page, html: readFileSync(page, 'utf8') }))
    .filter(({ html }) => html.includes('token-endpoint='));
}

describe('example pages — voice token pages also route text chat via the proxy', () => {
  it('every page with token-endpoint also sets api-endpoint', () => {
    const root = repoRoot();
    const pages = tokenEndpointPages(root);
    expect(pages.length).toBeGreaterThan(0);

    const violations = pages
      .filter(({ html }) => !html.includes('api-endpoint='))
      .map(({ page }) => page.slice(root.length + 1));

    expect(
      violations,
      `pages minting Live-only ephemeral tokens without a text-chat proxy attribute:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('every token-endpoint page has a config document with persona.chatProxyUrl', () => {
    const root = repoRoot();
    const pages = tokenEndpointPages(root);
    expect(pages.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const { page, html } of pages) {
      const rel = page.slice(root.length + 1);
      const configMatch = html.match(/config-url="([^"]+)"/);
      if (!configMatch) {
        violations.push(`${rel}: no config-url, so ChatPanel cannot receive persona.chatProxyUrl`);
        continue;
      }
      // config-url is site-root-relative; the gallery serves examples/ at /examples/.
      const configPath = join(root, configMatch[1].replace(/^\//, ''));
      let persona: { chatProxyUrl?: unknown };
      try {
        persona = JSON.parse(readFileSync(configPath, 'utf8')).persona ?? {};
      } catch (err) {
        violations.push(`${rel}: config ${configMatch[1]} unreadable (${String(err)})`);
        continue;
      }
      if (typeof persona.chatProxyUrl !== 'string' || persona.chatProxyUrl.trim().length === 0) {
        violations.push(
          `${rel}: ${configMatch[1]} persona.chatProxyUrl missing — text chat will spend Live-only tokens on generateContent`,
        );
      }
    }

    expect(violations, violations.join('\n')).toEqual([]);
  });
});
