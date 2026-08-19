/**
 * G3 gate for anon-key tenant lookup: public embed path must not
 * embed service role keys, provider SDKs, or secret env var names.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const FORBIDDEN_FINGERPRINTS = [
  'SUPABASE_SERVICE_ROLE',
  'service_role',
  'GEMINI_API_KEY',
  'VITE_GEMINI_API_KEY',
  'AIzaSy',
  '@google/genai',
  'sk_live_',
  'sbp_',
] as const;

function repoRoot(): string {
  const testPath = expect.getState().testPath;
  if (!testPath) throw new Error('vitest did not report a testPath');
  return resolve(dirname(testPath), '../..');
}

function tenantLookupDir(): string {
  return join(repoRoot(), 'src', 'embed', 'tenantLookup');
}

function listModules(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory) {
      files.push(...listModules(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files.sort();
}

describe('embed tenant lookup G3 boundary', () => {
  it('finds tenant lookup modules under test', () => {
    const names = listModules(tenantLookupDir()).map((file) =>
      relative(tenantLookupDir(), file));
    expect(names).toContain('anonKeyTenantLookup.ts');
    expect(names).toContain('sanitizeEmbedConfigDocument.ts');
  });

  it('runtime lookup modules contain no embedded credential fingerprints', () => {
    const root = tenantLookupDir();
    const runtimeModules = ['anonKeyTenantLookup.ts', 'readAnonKeyFromHost.ts', 'anonKeyLookupCache.ts', 'index.ts'];
    const offending = runtimeModules.flatMap((name) => {
      const file = join(root, name);
      const text = readFileSync(file, 'utf8');
      return FORBIDDEN_FINGERPRINTS.filter((fingerprint) => text.includes(fingerprint)).map(
        (fingerprint) => `${name} -> ${fingerprint}`);
    });
    expect(offending).toEqual([]);
  });

  it('sanitize strips secret-shaped response fields', async () => {
    const { sanitizeEmbedConfigDocument } = await import(
      '../../src/embed/tenantLookup/sanitizeEmbedConfigDocument'
    );
    const sanitized = sanitizeEmbedConfigDocument({
      tenant: 'acme',
      auth: { serviceRoleKey: 'secret' },
      openaiApiKey: 'sk_live_abc123',
    });
    expect(sanitized?.tenant).toBe('acme');
    expect(sanitized).not.toHaveProperty('auth');
    expect(sanitized).not.toHaveProperty('openaiApiKey');
  });
});
