/**
 * Repo-wide tldraw import boundary: tldraw, in values or types, may be
 * imported only from the engine implementation directory,
 * `src/engines/tldraw/` (the P4 rename wave's home; the pre-rename
 * `src/whiteboard/` fork was deleted in the 2026-08 remediation Wave 3).
 * Every other module under `src/` must stay engine-agnostic, and
 * `src/engine/` (the SPI contract) additionally must not reach into the
 * tldraw implementation.
 *
 * Same mechanics as panelsImportBoundary: walk the tree, collect each
 * import, export-from, dynamic import, and require specifier via the
 * TypeScript compiler API, and reject forbidden ones. Fixture cases prove
 * the collector detects violations and honors the allowlist, so the rule
 * cannot rot into a vacuous green. This suite runs in the standard
 * `npm run test` pipeline, which CI executes as a required job.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

function srcDir(): string {
 const testPath = expect.getState().testPath;
 if (!testPath) throw new Error('vitest did not report a testPath');
 return resolve(dirname(testPath), '../../src');
}

function engineImplDir(): string {
 return resolve(srcDir(), 'engines', 'tldraw');
}

function engineSpiDir(): string {
 return resolve(srcDir(), 'engine');
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

function isTldrawSpecifier(specifier: string): boolean {
 if (specifier === 'tldraw' || specifier.startsWith('tldraw/')) return true;
 if (specifier === '@tldraw' || specifier.startsWith('@tldraw/')) return true;
 return false;
}

function isEngineImplSpecifier(specifier: string, importingFile: string): boolean {
 if (specifier.startsWith('@/')) {
 return specifier.startsWith('@/engines/tldraw');
 }
 if (specifier.startsWith('.')) {
 const target = resolve(dirname(importingFile), specifier);
 return isInside(target, engineImplDir());
 }
 return false;
}

function tldrawViolationsIn(fileName: string, sourceText: string): string[] {
 return collectSpecifiers(fileName, sourceText).filter(isTldrawSpecifier);
}

function collectTldrawViolations(): string[] {
 const root = srcDir();
 const allowed = engineImplDir();
 return listModules(root).flatMap((file) => {
 if (isInside(file, allowed)) return [];
 const found = tldrawViolationsIn(file, readFileSync(file, 'utf8'));
 return found.map((specifier) => `${relative(root, file)} -> ${specifier}`);
 });
}

describe('src-wide tldraw engine boundary', () => {
 it('finds the modules it is guarding', () => {
 const moduleNames = listModules(srcDir()).map((file) => relative(srcDir(), file));
 expect(moduleNames).toContain(join('engine', 'types.ts'));
 expect(moduleNames).toContain(join('panels', 'host.ts'));
 expect(moduleNames).toContain(join('engines', 'tldraw', 'engine.ts'));
 });

 it('keeps every module outside src/engines/tldraw free of tldraw imports', () => {
 expect(collectTldrawViolations()).toEqual([]);
 });

 it('keeps the engine SPI directory free of engine-impl imports', () => {
 const offending = listModules(engineSpiDir()).flatMap((file) => {
 const found = collectSpecifiers(file, readFileSync(file, 'utf8')).filter(
 (specifier) =>
 isTldrawSpecifier(specifier) || isEngineImplSpecifier(specifier, file),
 );
 return found.map((specifier) => `${relative(srcDir(), file)} -> ${specifier}`);
 });
 expect(offending).toEqual([]);
 });

 it('detects tldraw violations rather than passing vacuously', () => {
 const fixturePath = join(srcDir(), 'panels', 'fixture.ts');
 const fixture = [
 "import { createShapeId } from 'tldraw';",
 "import type { Editor } from '@tldraw/editor';",
 "import('tldraw/store');",
 "const utils = require('@tldraw/utils');",
 "type E = import('tldraw').Editor;",
 "import { useState } from 'react';",
 "import type { Rect } from '../engine/types';",
 ].join('\n');

 expect(tldrawViolationsIn(fixturePath, fixture)).toEqual([
 'tldraw',
 '@tldraw/editor',
 'tldraw/store',
 '@tldraw/utils',
 'tldraw',
 ]);
 });

 it('detects violations at any depth outside the allowlist', () => {
 const nested = join(srcDir(), 'canvas', 'tools', 'fixture.ts');
 const fixture = "export { createShapeId } from 'tldraw';";
 expect(tldrawViolationsIn(nested, fixture)).toEqual(['tldraw']);
 });

 it('allows tldraw imports inside src/engines/tldraw only', () => {
 const allowedFile = join(engineImplDir(), 'shapes', 'fixture.ts');
 expect(isInside(allowedFile, engineImplDir())).toBe(true);
 const outsideFile = join(srcDir(), 'engines', 'tldraw-lookalike', 'fixture.ts');
 expect(isInside(outsideFile, engineImplDir())).toBe(false);
 });

 it('detects engine-impl imports from the engine SPI directory', () => {
 const fixturePath = join(engineSpiDir(), 'fixture.ts');
 const fixture = [
 "import { openPanelInCanvas } from '../engines/tldraw/shapes/panelShapeApi';",
 "import { createWhiteboardEngine } from '@/engines/tldraw/engine';",
 "import type { JsonObject } from '../panels/types';",
 ].join('\n');

 const offending = collectSpecifiers(fixturePath, fixture).filter(
 (specifier) =>
 isTldrawSpecifier(specifier) || isEngineImplSpecifier(specifier, fixturePath),
 );
 expect(offending).toEqual([
 '../engines/tldraw/shapes/panelShapeApi',
 '@/engines/tldraw/engine',
 ]);
 });
});
