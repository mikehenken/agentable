/**
 * G3 gate for the agent runtime boundary: `src/agents/` must not embed
 * provider keys, legacy Gemini env vars, or raw provider SDK imports. Keys and
 * SDKs stay behind the host resolver; legacy Gemini clients remain outside
 * this module until a later transport refactor.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const FORBIDDEN_FINGERPRINTS = [
  '@google/genai',
  '@google/generative-ai',
  'GoogleGenAI',
  'GEMINI_API_KEY',
  'VITE_GEMINI_API_KEY',
  'AIzaSy',
] as const;

const FORBIDDEN_IMPORT_PREFIXES = [
  '@google/genai',
  '@google/generative-ai',
  '../canvas/chat/geminiChatClient',
  '../canvas/voice/geminiLiveClient',
  '../../canvas/chat/geminiChatClient',
  '../../canvas/voice/geminiLiveClient',
] as const;

function repoRoot(): string {
  const testPath = expect.getState().testPath;
  if (!testPath) throw new Error('vitest did not report a testPath');
  return resolve(dirname(testPath), '../..');
}

function agentsDir(): string {
  return join(repoRoot(), 'src', 'agents');
}

function listModules(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listModules(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files.sort();
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
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isDynamicImport = callee.kind === ts.SyntaxKind.ImportKeyword;
      const arg = node.arguments[0];
      if (isDynamicImport && arg !== undefined && ts.isStringLiteral(arg)) {
        specifiers.push(arg.text);
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return specifiers;
}

describe('agents runtime G3 boundary', () => {
  it('finds the agents runtime modules under test', () => {
    const names = listModules(agentsDir()).map((file) => relative(agentsDir(), file));
    expect(names).toContain('index.ts');
    expect(names).toContain('modelResolver.ts');
    expect(names).toContain('session.ts');
    expect(names).toContain('capabilities.ts');
  });

  it('contains no provider keys or SDK fingerprints in src/agents', () => {
    const root = agentsDir();
    const offending = listModules(root).flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return FORBIDDEN_FINGERPRINTS.filter((fingerprint) => text.includes(fingerprint)).map(
        (fingerprint) => `${relative(root, file)} -> ${fingerprint}`);
    });
    expect(offending).toEqual([]);
  });

  it('imports no provider SDK or legacy Gemini client modules', () => {
    const root = agentsDir();
    const offending = listModules(root).flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      const specifiers = collectSpecifiers(file, text);
      return specifiers.filter((specifier) =>
          FORBIDDEN_IMPORT_PREFIXES.some(
            (prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`))).map((specifier) => `${relative(root, file)} -> ${specifier}`);
    });
    expect(offending).toEqual([]);
  });

  it('detects violations rather than passing vacuously', () => {
    const fixture = [
      "import { GoogleGenAI } from '@google/genai';",
      "const key = import.meta.env.VITE_GEMINI_API_KEY;",
      "export { createGeminiChatClient } from '../canvas/chat/geminiChatClient';",
    ].join('\n');

    const fingerprintHits = FORBIDDEN_FINGERPRINTS.filter((fingerprint) =>
      fixture.includes(fingerprint));
    expect(fingerprintHits.length).toBeGreaterThan(0);

    const importHits = collectSpecifiers('fixture.ts', fixture).filter((specifier) =>
      FORBIDDEN_IMPORT_PREFIXES.some((prefix) => specifier.startsWith(prefix)));
    expect(importHits).toEqual(['@google/genai', '../canvas/chat/geminiChatClient']);
  });
});
