/**
 * Exported-surface snapshot for `src/panels/types.ts`, the panel system's
 * public contract module.
 *
 * The module is types-only, so its runtime export object is empty and a
 * plain `import` cannot observe drift. Instead the suite parses the source
 * with the TypeScript compiler API and pins:
 *
 *   1. the exact set of exported declaration names (adding, removing, or
 *      renaming a contract fails the test until the list is updated
 *      deliberately), and
 *   2. that every export is an interface or type alias, so no runtime
 *      value sneaks into the contract module.
 *
 * `expectTypeOf` was rejected for this job: `vitest run` transpiles without
 * typechecking and the tests directory is outside the `tsc -b` project, so
 * type-level assertions here would never fail a test run.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

// happy-dom rewrites `import.meta.url` to an http URL, so the on-disk
// location comes from vitest's test state instead.
function typesPath(): string {
  const testPath = expect.getState().testPath;
  if (!testPath) throw new Error('vitest did not report a testPath');
  return resolve(dirname(testPath), '../../src/panels/types.ts');
}

const EXPECTED_EXPORTS = [
  'CatalogEntry',
  'JsonObject',
  'JsonPrimitive',
  'JsonValue',
  'PanelChromeOptions',
  'PanelDefinition',
  'PanelFillResult',
  'PanelHandle',
  'PanelMeta',
  'PanelProps',
  'PanelScope',
  'PanelSpec',
  'SpecAction',
  'SpecCondition',
  'SpecMigration',
  'SpecNode',
  'SpecNodeContextValue',
  'SpecOrigin',
  'SpecSourceBinding',
];

interface ExportedDeclaration {
  name: string;
  typeOnly: boolean;
}

function readExportedDeclarations(): ExportedDeclaration[] {
  const filePath = typesPath();
  const source = ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const found: ExportedDeclaration[] = [];

  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      const clause = statement.exportClause;
      if (clause && ts.isNamedExports(clause)) {
        for (const element of clause.elements) {
          found.push({
            name: element.name.text,
            typeOnly: statement.isTypeOnly || element.isTypeOnly,
          });
        }
      } else {
        found.push({ name: statement.getText(source).trim(), typeOnly: false });
      }
      continue;
    }
    if (ts.isExportAssignment(statement)) {
      found.push({ name: 'default', typeOnly: false });
      continue;
    }

    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    const exported = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    if (!exported) continue;

    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      found.push({ name: statement.name.text, typeOnly: true });
    } else if (
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      found.push({ name: statement.name?.text ?? '(anonymous)', typeOnly: false });
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        found.push({ name: declaration.name.getText(source), typeOnly: false });
      }
    } else if (ts.isModuleDeclaration(statement)) {
      found.push({ name: statement.name.getText(source), typeOnly: false });
    }
  }

  return found;
}

describe('panels/types exported surface', () => {
  it('exports exactly the expected contract names', () => {
    const names = readExportedDeclarations()
      .map((declaration) => declaration.name)
      .sort();
    expect(names).toEqual(EXPECTED_EXPORTS);
  });

  it('remains a types-only module in source', () => {
    const runtimeExports = readExportedDeclarations().filter(
      (declaration) => !declaration.typeOnly,
    );
    expect(runtimeExports).toEqual([]);
  });

  it('emits no runtime bindings', async () => {
    const mod = await import('../../src/panels/types');
    expect(Object.keys(mod)).toEqual([]);
  });
});
