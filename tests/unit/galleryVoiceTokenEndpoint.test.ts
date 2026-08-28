/**
 * Deployed-gallery voice wiring guard.
 *
 * The examples gallery deploys with a same-origin token mint at
 * /v1/voice/token (functions/v1/voice/token.js, G3: provider keys stay
 * server-side). The embeds only reach it through configuration; when no
 * config carries a tokenEndpoint, every voice-bearing page logs the
 * voiceKernel PRODUCTION misconfiguration error and the voice CTA fails
 * live (baseline 2026-08-28, docs/status/remediation-wave-0-baseline.md).
 *
 * Two invariants:
 *  1. Every shared example config document declares
 *     persona.tokenEndpoint = /v1/voice/token, the same config-document
 *     delivery path the chat proxy URL uses.
 *  2. The config.local.json probes in examples 08 and p8 require a JSON
 *     content type before accepting a candidate; on SPA-fallback hosts
 *     (Cloudflare Pages) a missing file answers 200 text/html, which used
 *     to select the absent local config and feed HTML to the element's
 *     JSON parser on every load.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function repoRoot(): string {
  const testPath = expect.getState().testPath;
  if (!testPath) throw new Error('vitest did not report a testPath');
  return resolve(dirname(testPath), '../..');
}

const TOKEN_ENDPOINT = '/v1/voice/token';

describe('gallery voice token endpoint wiring', () => {
  it('finds the shared config documents it is guarding', () => {
    const files = readdirSync(join(repoRoot(), 'examples/shared')).filter((f) =>
      f.endsWith('-config.json'),
    );
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it('every shared config document carries the same-origin token endpoint', () => {
    const sharedDir = join(repoRoot(), 'examples/shared');
    const missing: string[] = [];
    for (const file of readdirSync(sharedDir)) {
      if (!file.endsWith('-config.json')) continue;
      const doc = JSON.parse(readFileSync(join(sharedDir, file), 'utf8')) as {
        tokenEndpoint?: string;
        persona?: { tokenEndpoint?: string };
      };
      const endpoint = doc.persona?.tokenEndpoint ?? doc.tokenEndpoint;
      if (endpoint !== TOKEN_ENDPOINT) missing.push(`${file} -> ${String(endpoint)}`);
    }
    expect(missing).toEqual([]);
  });

  it('example 04 keeps its element-attribute token endpoint', () => {
    const html = readFileSync(
      join(repoRoot(), 'examples/04-zero-js-marketing/index.html'),
      'utf8',
    );
    expect(html).toContain(`token-endpoint="${TOKEN_ENDPOINT}"`);
  });

  it('config.local.json probes require a JSON content type', () => {
    for (const page of [
      'examples/08-agent-presents/index.html',
      'examples/p8-agent-draw-demo/index.html',
    ]) {
      const html = readFileSync(join(repoRoot(), page), 'utf8');
      expect(html, page).toContain("contentType.includes('json')");
      expect(html, page).toContain('config.local.json');
    }
  });
});
