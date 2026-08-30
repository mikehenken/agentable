/**
 * Core must not depend on example code. No module under `src/` may import
 * from `examples/` (in values or types, static or dynamic): examples are
 * downstream consumers and demo fixtures, and coupling core to them leaks
 * demo data into shipped bundles and breaks the standalone-example
 * contract. Demo fixtures core needs live in `src/embed/meridian/fixtures/`
 * (the 2026-08 Wave 7 move); examples keep their own copies only when an
 * example runtime imports them directly.
 *
 * Same TS-walk mechanics as engineImportBoundary: collect each import,
 * export-from, dynamic import, and require specifier via the TypeScript
 * compiler API and reject any that resolves into `examples/`. Fixture
 * cases prove the collector detects violations, so the rule cannot rot
 * into a vacuous green. Runs in the standard `npm run test` pipeline.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

function repoRoot(): string {
  const testPath = expect.getState().testPath;
  if (!testPath) throw new Error('vitest did not report a testPath');
  return resolve(dirname(testPath), '../..');
}

function srcDir(): string {
  return resolve(repoRoot(), 'src');
}

function examplesDir(): string {
  return resolve(repoRoot(), 'examples');
}

function isInside(file: string, dir: string): boolean {
  return file === dir || file.startsWith(dir + sep);
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

function isExamplesSpecifier(specifier: string, importingFile: string): boolean {
  if (specifier.startsWith('@/')) {
    return specifier.startsWith('@/examples') || specifier.startsWith('@/../examples');
  }
  if (specifier.startsWith('.')) {
    const target = resolve(dirname(importingFile), specifier);
    return isInside(target, examplesDir());
  }
  return false;
}

function examplesViolationsIn(fileName: string, sourceText: string): string[] {
  return collectSpecifiers(fileName, sourceText).filter((specifier) =>
    isExamplesSpecifier(specifier, fileName),
  );
}

function collectExamplesViolations(): string[] {
  const root = srcDir();
  return listModules(root).flatMap((file) => {
    const found = examplesViolationsIn(file, readFileSync(file, 'utf8'));
    return found.map((specifier) => `${relative(root, file)} -> ${specifier}`);
  });
}

describe('src-wide examples import boundary', () => {
  it('finds the modules it is guarding', () => {
    const moduleNames = listModules(srcDir()).map((file) => relative(srcDir(), file));
    expect(moduleNames).toContain(join('embed', 'galleryScriptedDemo.ts'));
    expect(moduleNames).toContain(join('embed', 'meridian', 'fixtures', 'meridianLabs.ts'));
  });

  it('keeps every module under src/ free of examples/ imports', () => {
    expect(collectExamplesViolations()).toEqual([]);
  });

  it('detects examples imports rather than passing vacuously', () => {
    const fixturePath = join(srcDir(), 'embed', 'fixture.ts');
    const fixture = [
      "import { MERIDIAN_DOCUMENT_ID } from '../../examples/12-open-agent-canvas/fixtures/meridianLabs';",
      "export { NORTHSTAR_AGENT } from '../../examples/p8-agent-draw-demo/fixtures/northstarBrand';",
      "import('../../examples/foo/bar');",
      "type E = import('../../examples/foo').Thing;",
      "import { useState } from 'react';",
      "import type { Rect } from '../engine/types';",
    ].join('\n');

    expect(examplesViolationsIn(fixturePath, fixture)).toEqual([
      '../../examples/12-open-agent-canvas/fixtures/meridianLabs',
      '../../examples/p8-agent-draw-demo/fixtures/northstarBrand',
      '../../examples/foo/bar',
      '../../examples/foo',
    ]);
  });

  it('allows src-internal and package imports', () => {
    const fixturePath = join(srcDir(), 'agents', 'surface', 'fixture.ts');
    const fixture = [
      "import { MERIDIAN_DOCUMENT_ID } from '../../embed/meridian/fixtures/meridianLabs';",
      "import { createCanvasHost } from '../../panels/host';",
      "import ts from 'typescript';",
    ].join('\n');

    expect(examplesViolationsIn(fixturePath, fixture)).toEqual([]);
  });
});
