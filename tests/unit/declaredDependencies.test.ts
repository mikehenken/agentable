/**
 * Phantom-dependency guard: every bare import specifier used anywhere under
 * `tests/` must be declared in package.json. Transitively hoisted packages
 * (present in node_modules only because some dependency happens to pull them
 * in) work until an unrelated lockfile refresh silently removes them; this
 * suite makes that failure mode a red test instead of a broken CI run.
 *
 * Same collector mechanics as engineImportBoundary: walk the tree, collect
 * every import / export-from / dynamic import / require specifier via the
 * TypeScript compiler API, and check the package root of each bare specifier
 * against the declared dependency fields. Fixture cases prove the collector
 * and the package-root mapping work, so the rule cannot rot into a vacuous
 * green.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { builtinModules } from 'node:module';
import ts from 'typescript';

function repoRoot(): string {
  const testPath = expect.getState().testPath;
  if (!testPath) throw new Error('vitest did not report a testPath');
  return resolve(dirname(testPath), '../..');
}

function testsDir(): string {
  return resolve(repoRoot(), 'tests');
}

/**
 * Resolver aliases defined in vitest.config.ts. Kept as a literal here and
 * cross-checked against the config text below so the two lists cannot drift
 * apart silently.
 */
const RESOLVER_ALIASES = [
  '@',
  '@agentable/career-pack',
  '@agentable/support-inbox-pack',
  '@agentable/catalog-charts',
] as const;

/**
 * Aliases defined in vite.config.ts (build-time resolver), cross-checked
 * against that config text below. `classnames-original` is the ESM-interop
 * shim indirection, not an npm package.
 */
const VITE_BUILD_ALIASES = ['classnames-original'] as const;

const NODE_BUILTINS = new Set(builtinModules);

function listModules(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listModules(full));
    } else if (/\.(ts|tsx|mts|mjs)$/.test(entry.name)) {
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

/** Map a bare specifier to its package root: `foo/sub` -> `foo`, `@s/n/sub` -> `@s/n`. */
function packageRoot(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function isBareSpecifier(specifier: string): boolean {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return false;
  if (specifier.startsWith('node:')) return false;
  if (NODE_BUILTINS.has(packageRoot(specifier))) return false;
  const aliases: readonly string[] = [...RESOLVER_ALIASES, ...VITE_BUILD_ALIASES];
  return !aliases.some(
    (alias) => specifier === alias || specifier.startsWith(`${alias}/`),
  );
}

function declaredPackages(): Set<string> {
  const pkg = JSON.parse(readFileSync(join(repoRoot(), 'package.json'), 'utf8')) as Record<
    string,
    Record<string, string> | undefined
  >;
  const declared = new Set<string>();
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const name of Object.keys(pkg[field] ?? {})) declared.add(name);
  }
  return declared;
}

function undeclaredIn(fileName: string, sourceText: string, declared: Set<string>): string[] {
  return collectSpecifiers(fileName, sourceText)
    .filter(isBareSpecifier)
    .map(packageRoot)
    .filter((root) => !declared.has(root));
}

describe('declared dependencies for tests/', () => {
  it('finds the modules it is guarding', () => {
    const names = listModules(testsDir()).map((file) => relative(testsDir(), file));
    expect(names).toContain(join('unit', 'declaredDependencies.test.ts'));
    expect(names.length).toBeGreaterThan(100);
  });

  it('keeps the alias allowlist aligned with vitest.config.ts', () => {
    const configText = readFileSync(join(repoRoot(), 'vitest.config.ts'), 'utf8');
    for (const alias of RESOLVER_ALIASES) {
      expect(configText).toContain(`'${alias}'`);
    }
  });

  it('keeps the vite build-alias allowlist aligned with vite.config.ts', () => {
    const configText = readFileSync(join(repoRoot(), 'vite.config.ts'), 'utf8');
    for (const alias of VITE_BUILD_ALIASES) {
      expect(configText).toContain(`"${alias}"`);
    }
  });

  it('every bare import in tests/ is declared in package.json', () => {
    const declared = declaredPackages();
    const violations = listModules(testsDir()).flatMap((file) => {
      const undeclared = undeclaredIn(file, readFileSync(file, 'utf8'), declared);
      return [...new Set(undeclared)].map(
        (root) => `${relative(repoRoot(), file)} -> ${root}`,
      );
    });
    expect(violations).toEqual([]);
  });

  it('every bare import in src/ is declared in package.json', () => {
    // The parent directory is an npm workspace root, so `../node_modules`
    // hoisting resolves undeclared packages locally while a clean CI checkout
    // cannot (src/mcp -> @modelcontextprotocol/sdk was exactly this). Same
    // guard as tests/, applied to shipped source.
    const declared = declaredPackages();
    const violations = listModules(resolve(repoRoot(), 'src')).flatMap((file) => {
      const undeclared = undeclaredIn(file, readFileSync(file, 'utf8'), declared);
      return [...new Set(undeclared)].map(
        (root) => `${relative(repoRoot(), file)} -> ${root}`,
      );
    });
    expect(violations).toEqual([]);
  });

  it('detects undeclared imports rather than passing vacuously', () => {
    const declared = new Set(['react', '@scope/declared']);
    const fixture = [
      "import yaml from 'some-phantom-package';",
      "import { load } from 'some-phantom-package/dist/loader';",
      "import sub from '@scope/undeclared/sub';",
      "import ok from '@scope/declared/sub';",
      "import { useState } from 'react';",
      "import { helper } from './helper';",
      "import { readFileSync } from 'node:fs';",
      "import path from 'path';",
      "import app from '@/embed/agentable-canvas';",
      "const dyn = await import('phantom-dynamic');",
      "const req = require('phantom-required');",
    ].join('\n');
    expect(undeclaredIn(join(testsDir(), 'unit', 'fixture.ts'), fixture, declared)).toEqual([
      'some-phantom-package',
      'some-phantom-package',
      '@scope/undeclared',
      'phantom-dynamic',
      'phantom-required',
    ]);
  });

  it('maps specifiers to package roots correctly', () => {
    expect(packageRoot('js-yaml')).toBe('js-yaml');
    expect(packageRoot('js-yaml/dist/loader')).toBe('js-yaml');
    expect(packageRoot('@types/js-yaml')).toBe('@types/js-yaml');
    expect(packageRoot('@lit-labs/observers/resize-controller.js')).toBe('@lit-labs/observers');
  });
});
