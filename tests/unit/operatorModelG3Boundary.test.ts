/**
 * G3 gate for operator model bridge: surface bridge modules must not
 * embed provider keys or SDK imports; model ids resolve only via host resolver.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import ts from 'typescript';

const FORBIDDEN_FINGERPRINTS = [
  '@google/genai',
  '@google/generative-ai',
  'GoogleGenAI',
  'GEMINI_API_KEY',
  'VITE_GEMINI_API_KEY',
  'AIzaSy',
  'sk_live_',
  'openaiApiKey',
] as const;

const BRIDGE_MODULES = [
  'operatorModelBridge.ts',
  'operator-surface.ts',
  'constants.ts',
  'types.ts',
] as const;

const EMBED_BUNDLE_CANDIDATES = [
  'dist/embed/agentable-canvas.js',
  'dist/embed/agentable-whiteboard.js',
  'dist/embed/agentable-operator-surface.js',
  'dist/embed/agentable-operator-surface-placement.js',
] as const;

function repoRoot(): string {
  const testPath = expect.getState().testPath;
  if (!testPath) throw new Error('vitest did not report a testPath');
  return resolve(dirname(testPath), '../..');
}

function surfaceDir(): string {
  return join(repoRoot(), 'src', 'agents', 'surface');
}

function collectSpecifiers(fileName: string, sourceText: string): string[] {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];

  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return specifiers;
}

function grepForbidden(text: string): string[] {
  return FORBIDDEN_FINGERPRINTS.filter((fingerprint) => text.includes(fingerprint));
}

describe('operator model bridge G3 boundary ', () => {
  it('bridge source modules contain no provider key fingerprints', () => {
    const root = surfaceDir();
    const offending = BRIDGE_MODULES.flatMap((name) => {
      const file = join(root, name);
      const text = readFileSync(file, 'utf8');
      return grepForbidden(text).map((fingerprint) => `${name} -> ${fingerprint}`);
    });
    expect(offending).toEqual([]);
  });

  it('bridge modules import no provider SDK packages', () => {
    const root = surfaceDir();
    const offending = BRIDGE_MODULES.flatMap((name) => {
      const file = join(root, name);
      const text = readFileSync(file, 'utf8');
      return collectSpecifiers(file, text).filter((specifier) => specifier.includes('@google/') || specifier.includes('genai')).map((specifier) => `${name} -> ${specifier}`);
    });
    expect(offending).toEqual([]);
  });

  it('records embed bundle grep proof when dist is present (legacy chat keys pre-exist)', () => {
    const root = repoRoot();
    const existing = EMBED_BUNDLE_CANDIDATES.filter((rel) => existsSync(join(root, rel)));
    if (existing.length === 0) {
      expect(existing).toEqual([]);
      return;
    }

    const bridgeScopedOffending = existing.flatMap((rel) => {
      const text = readFileSync(join(root, rel), 'utf8');
      const hits = grepForbidden(text);
      const bridgeScoped = hits.filter(
        (fingerprint) =>
          text.includes('operatorModelBridge') &&
          (fingerprint === 'GEMINI_API_KEY' ||
            fingerprint === 'VITE_GEMINI_API_KEY' ||
            fingerprint === 'AIzaSy'));
      return bridgeScoped.map((fingerprint) => `${rel} -> ${fingerprint}`);
    });

    expect(bridgeScopedOffending).toEqual([]);
  });

  it('lists operator surface modules under test', () => {
    const names = readdirSync(surfaceDir()).filter((name) => name.endsWith('.ts'));
    expect(names).toContain('operatorModelBridge.ts');
    expect(names).toContain('operator-surface.ts');
  });
});
