/**
 * Engine-boundary rule for the panel system: no module under `src/panels/`
 * may import tldraw (values or types) or reach into `src/whiteboard/`. The
 * host consumes an engine handle; tldraw specifics live behind it in the
 * engine directory only.
 *
 * The suite walks every module in the directory, collects each import,
 * export-from, dynamic import, and require specifier via the TypeScript
 * compiler API, and rejects forbidden ones. Relative specifiers resolve
 * against the importing file and are tested for containment in the
 * whiteboard directory itself, so the rule holds at any nesting depth
 * under src/panels. Fixture cases prove the collector actually detects
 * violations, flat and nested, so the rule cannot rot into a vacuous
 * green.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

function panelsDir(): string {
  const testPath = expect.getState().testPath;
  if (!testPath) throw new Error('vitest did not report a testPath');
  return resolve(dirname(testPath), '../../src/panels');
}

function whiteboardDir(): string {
  return resolve(panelsDir(), '..', 'whiteboard');
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
      const isRequire = ts.isIdentifier(callee) && callee.text === 'require';
      const arg = node.arguments[0];
      if ((isDynamicImport || isRequire) && arg !== undefined && ts.isStringLiteral(arg)) {
        specifiers.push(arg.text);
      }
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      const literal = node.argument.literal;
      if (ts.isStringLiteral(literal)) {
        specifiers.push(literal.text);
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return specifiers;
}

function isForbidden(specifier: string, importingFile: string, forbiddenDir: string): boolean {
  if (specifier === 'tldraw' || specifier.startsWith('tldraw/')) return true;
  if (specifier === '@tldraw' || specifier.startsWith('@tldraw/')) return true;
  if (specifier.startsWith('@/')) {
    return specifier.startsWith('@/whiteboard');
  }
  if (specifier.startsWith('.')) {
    const target = resolve(dirname(importingFile), specifier);
    return target === forbiddenDir || target.startsWith(forbiddenDir + sep);
  }
  return false;
}

function violationsIn(fileName: string, sourceText: string, forbiddenDir: string): string[] {
  return collectSpecifiers(fileName, sourceText).filter((specifier) =>
    isForbidden(specifier, fileName, forbiddenDir),
  );
}

describe('panels engine boundary', () => {
  it('finds the panel modules it is guarding', () => {
    const moduleNames = listModules(panelsDir()).map((file) => relative(panelsDir(), file));
    expect(moduleNames).toContain('host.ts');
    expect(moduleNames).toContain('types.ts');
  });

  it('keeps every panels module free of tldraw and whiteboard imports', () => {
    const forbiddenDir = whiteboardDir();
    const offending = listModules(panelsDir()).flatMap((file) => {
      const found = violationsIn(file, readFileSync(file, 'utf8'), forbiddenDir);
      return found.map((specifier) => `${relative(panelsDir(), file)} -> ${specifier}`);
    });
    expect(offending).toEqual([]);
  });

  it('detects violations rather than passing vacuously', () => {
    const fixturePath = join(panelsDir(), 'fixture.ts');
    const fixture = [
      "import { createShapeId } from 'tldraw';",
      "import type { Editor } from '@tldraw/editor';",
      "export { bindEditor } from '../whiteboard/shapes/panelShapeApi';",
      "import('tldraw/store');",
      "const api = require('@/whiteboard/shapes/panelShapeApi');",
      "type E = import('tldraw').Editor;",
      "import { useState } from 'react';",
      "import type { PanelScope } from './types';",
    ].join('\n');

    expect(violationsIn(fixturePath, fixture, whiteboardDir())).toEqual([
      'tldraw',
      '@tldraw/editor',
      '../whiteboard/shapes/panelShapeApi',
      'tldraw/store',
      '@/whiteboard/shapes/panelShapeApi',
      'tldraw',
    ]);
  });

  it('catches whiteboard imports from nested panels modules', () => {
    const fixturePath = join(panelsDir(), 'spec', 'fixture.ts');
    const fixture = [
      "export { bindEditor } from '../../whiteboard/shapes/panelShapeApi';",
      "import { loadWhiteboardSnapshot } from '../../whiteboard';",
      "import type { PanelScope } from '../types';",
      "import { validateSpec } from './validate';",
    ].join('\n');

    expect(violationsIn(fixturePath, fixture, whiteboardDir())).toEqual([
      '../../whiteboard/shapes/panelShapeApi',
      '../../whiteboard',
    ]);
  });
});
