/**
 * G3 build guard: shipped embed bundles must never inline a provider key.
 *
 * `useGeminiLive` and `whiteboardChatCredentials` read
 * `import.meta.env.VITE_GEMINI_API_KEY`; vite substitutes that at build
 * time, so an embed built on a machine whose .env.local carries a real key
 * bakes the credential into the artifact. That is exactly what happened to
 * the committed dist blobs (found 2026-08-28: the public repo's committed
 * agentable-canvas bundles answered apiKeyPresent: true at runtime).
 *
 * The fix is structural: every embed build config defines
 * `import.meta.env.VITE_GEMINI_API_KEY` as the empty string, so the
 * substitution can never carry a key regardless of the building machine's
 * env. This suite keeps that true for every embed config, current and
 * future.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function repoRoot(): string {
  const testPath = expect.getState().testPath;
  if (!testPath) throw new Error('vitest did not report a testPath');
  return resolve(dirname(testPath), '../..');
}

const STRIP_DEFINE = "'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify('')";

describe('embed key-strip guard', () => {
  it('finds the embed build configs it is guarding', () => {
    const configs = readdirSync(repoRoot()).filter(
      (f) => f.startsWith('vite.embed') && f.endsWith('.ts'),
    );
    expect(configs.length).toBeGreaterThanOrEqual(14);
  });

  it('every embed build config strips the provider key at build time', () => {
    const root = repoRoot();
    const shared = readFileSync(join(root, 'vite.embed-widget-shared.ts'), 'utf8');
    expect(shared, 'vite.embed-widget-shared.ts').toContain(STRIP_DEFINE);

    // Shared helpers, not build configs: they hold no `define` block; the
    // configs that consume them carry the key-strip (or delegate to the factory,
    // which does).
    const SHARED_HELPERS = new Set(['vite.embed-widget-shared.ts', 'vite.embed-chunking.ts']);
    const missing: string[] = [];
    for (const file of readdirSync(root)) {
      if (!file.startsWith('vite.embed') || !file.endsWith('.ts')) continue;
      if (SHARED_HELPERS.has(file)) continue;
      const text = readFileSync(join(root, file), 'utf8');
      const covered =
        text.includes('defineEmbedWidgetConfig') || text.includes(STRIP_DEFINE);
      if (!covered) missing.push(file);
    }
    expect(missing).toEqual([]);
  });

  it('the credential readers still reference the env var it neutralizes', () => {
    // If the sinks move away from VITE_GEMINI_API_KEY, this guard must be
    // rethought rather than silently guarding a dead name.
    const root = repoRoot();
    for (const sink of ['src/voice/useGeminiLive.ts', 'src/chat/whiteboardChatCredentials.ts']) {
      expect(readFileSync(join(root, sink), 'utf8'), sink).toContain('VITE_GEMINI_API_KEY');
    }
  });
});
