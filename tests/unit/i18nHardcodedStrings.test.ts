/**
 * D42 AC teeth, the "CI grep": no hardcoded user-facing strings outside
 * the English catalog. Implemented as a TypeScript-AST scan (stronger
 * than a text grep: it cannot be fooled by formatting) over every module
 * in the i18n-governed directories, wired into the vitest suite CI
 * already runs.
 *
 * THE RULE. Inside the scanned directories (`src/panels/`, `src/i18n/`),
 * excluding the catalog directory (`src/i18n/catalog/`, where message
 * source text lives by design), a violation is:
 *
 *   1. JSX text content containing letters ("<div>Loading...</div>"),
 *   2. a string/template literal JSX expression child ("{'Loading'}"),
 *   3. a string literal in a user-visible JSX attribute (title,
 *      placeholder, alt, label, aria-label, aria-description,
 *      aria-roledescription, aria-valuetext) containing letters,
 *   4. a string/template literal passed as the `message` argument or
 *      `hint` property of the validator's `issue(...)` factory.
 *
 * Out of scope, documented: `data-testid` and other machine-facing
 * attributes; `console.*` developer diagnostics; thrown `Error` messages
 * (developer-facing, not rendered); string literals in plain logic
 * (source names, ids, css classes). As later phases externalize more
 * chrome (P4/P5 packs and embeds), their directories join SCANNED_DIRS.
 *
 * Fixture cases at the bottom prove the collector detects each violation
 * class, so the gate cannot rot into a vacuous green.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

const SCANNED_DIRS = ['src/panels', 'src/i18n'] as const;
const EXCLUDED_DIRS = ['src/i18n/catalog'] as const;

const USER_FACING_ATTRIBUTES = new Set([
  'title',
  'placeholder',
  'alt',
  'label',
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
]);

function repoRoot(): string {
  const testPath = expect.getState().testPath;
  if (!testPath) throw new Error('vitest did not report a testPath');
  return resolve(dirname(testPath), '../..');
}

function listModules(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listModules(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files.sort();
}

function isExcluded(file: string, root: string): boolean {
  return EXCLUDED_DIRS.some((dir) => {
    const excluded = resolve(root, dir);
    return file === excluded || file.startsWith(excluded + sep);
  });
}

function hasLetters(text: string): boolean {
  return /[A-Za-z]/.test(text);
}

function isStringLike(
  node: ts.Node,
): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | ts.TemplateExpression {
  return (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateExpression(node)
  );
}

function stringLikeText(node: ts.Node): string {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join('');
  }
  return '';
}

interface Violation {
  kind: 'jsx-text' | 'jsx-expression' | 'jsx-attribute' | 'issue-factory';
  text: string;
  line: number;
}

function collectViolations(fileName: string, sourceText: string): Violation[] {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations: Violation[] = [];

  const record = (kind: Violation['kind'], node: ts.Node, text: string): void => {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    violations.push({ kind, text: text.trim(), line });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node) && hasLetters(node.text)) {
      record('jsx-text', node, node.text);
    }

    if (
      ts.isJsxExpression(node) &&
      node.expression !== undefined &&
      isStringLike(node.expression) &&
      hasLetters(stringLikeText(node.expression)) &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      record('jsx-expression', node, stringLikeText(node.expression));
    }

    if (
      ts.isJsxAttribute(node) &&
      USER_FACING_ATTRIBUTES.has(node.name.getText(source)) &&
      node.initializer !== undefined
    ) {
      const value = ts.isStringLiteral(node.initializer)
        ? node.initializer
        : ts.isJsxExpression(node.initializer) &&
            node.initializer.expression !== undefined &&
            isStringLike(node.initializer.expression)
          ? node.initializer.expression
          : undefined;
      if (value !== undefined && hasLetters(stringLikeText(value))) {
        record('jsx-attribute', node, stringLikeText(value));
      }
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'issue'
    ) {
      const message = node.arguments[1];
      if (message !== undefined && isStringLike(message) && hasLetters(stringLikeText(message))) {
        record('issue-factory', message, stringLikeText(message));
      }
      const extra = node.arguments[3];
      if (extra !== undefined && ts.isObjectLiteralExpression(extra)) {
        for (const property of extra.properties) {
          if (
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === 'hint' &&
            isStringLike(property.initializer) &&
            hasLetters(stringLikeText(property.initializer))
          ) {
            record('issue-factory', property.initializer, stringLikeText(property.initializer));
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return violations;
}

describe('D42 hardcoded user-facing strings gate', () => {
  it('finds the modules it is guarding', () => {
    const root = repoRoot();
    const files = SCANNED_DIRS.flatMap((dir) => listModules(resolve(root, dir)));
    const names = files.map((file) => relative(root, file).replaceAll(sep, '/'));
    expect(names).toContain('src/panels/renderer/SpecRenderer.tsx');
    expect(names).toContain('src/panels/catalog/components.tsx');
    expect(names).toContain('src/panels/spec/validate.ts');
    expect(names).toContain('src/i18n/index.ts');
  });

  it('excludes only the English/locale catalog directory from the scan', () => {
    const root = repoRoot();
    expect(isExcluded(resolve(root, 'src/i18n/catalog/en.ts'), root)).toBe(true);
    expect(isExcluded(resolve(root, 'src/i18n/index.ts'), root)).toBe(false);
    expect(isExcluded(resolve(root, 'src/panels/catalog/components.tsx'), root)).toBe(false);
  });

  it('reports no hardcoded user-facing strings outside the English catalog', () => {
    const root = repoRoot();
    const offending = SCANNED_DIRS.flatMap((dir) =>
      listModules(resolve(root, dir))
        .filter((file) => !isExcluded(file, root))
        .flatMap((file) =>
          collectViolations(file, readFileSync(file, 'utf8')).map(
            (violation) =>
              `${relative(root, file).replaceAll(sep, '/')}:${violation.line} [${violation.kind}] "${violation.text}"`,
          ),
        ),
    );
    expect(offending).toEqual([]);
  });

  it('detects JSX text, expression, and attribute violations rather than passing vacuously', () => {
    const fixture = [
      'export function Bad() {',
      '  return (',
      '    <div title="Hover me" data-testid="ok-machine-string">',
      '      Hardcoded text',
      "      {'Also hardcoded'}",
      '      {`Template hardcoded`}',
      '      <input placeholder={"Type here"} aria-label="Search jobs" />',
      '    </div>',
      '  );',
      '}',
    ].join('\n');

    const found = collectViolations('fixture.tsx', fixture);
    expect(found.map((violation) => `${violation.kind}:${violation.text}`)).toEqual([
      'jsx-attribute:Hover me',
      'jsx-text:Hardcoded text',
      'jsx-expression:Also hardcoded',
      'jsx-expression:Template hardcoded',
      'jsx-attribute:Type here',
      'jsx-attribute:Search jobs',
    ]);
  });

  it('detects issue-factory message and hint literals, including templates', () => {
    const fixture = [
      "issue('SPEC_X', 'Hardcoded message', 'error', { hint: 'Hardcoded hint' });",
      'issue(`SPEC_Y`, `Value ${value} is bad`, `error`, { nodeId, hint: t(`validation.ok`) });',
      "issue('SPEC_Z', t('validation.ok', { max: 3 }), 'error', { hint: t('validation.ok.hint') });",
    ].join('\n');

    const found = collectViolations('fixture.ts', fixture);
    expect(found.map((violation) => `${violation.kind}:${violation.text}`)).toEqual([
      'issue-factory:Hardcoded message',
      'issue-factory:Hardcoded hint',
      'issue-factory:Value  is bad',
    ]);
  });

  it('ignores machine-facing strings (testids, keys, css, non-letter text)', () => {
    const fixture = [
      'export function Fine() {',
      '  return (',
      '    <div data-testid="loading-skeleton" className="mt-2 flex" role="status" aria-busy="true">',
      '      {t(\'catalog.state.loading\')}',
      '      ...',
      '      {value}',
      '    </div>',
      '  );',
      '}',
    ].join('\n');

    expect(collectViolations('fixture.tsx', fixture)).toEqual([]);
  });
});
