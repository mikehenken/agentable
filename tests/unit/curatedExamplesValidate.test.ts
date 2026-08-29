/**
 * CI validation: every curated example spec must pass validateSpec.
 */
import { describe, expect, it } from 'vitest';
import { v1CatalogEntries } from '../../src/panels/catalog/v1-entries';
import {
  allCuratedExampleEntries,
  buildValidationContextFromHints,
} from '../../src/panels/describe/curatedExamples';
import { validateSpec } from '../../src/panels/spec';

describe('curated example specs ( CI guard)', () => {
  const entries = allCuratedExampleEntries;

  it('defines at least two examples per v1 catalog entry', () => {
    for (const catalogName of v1CatalogEntries.keys()) {
      const count = entries().filter(
        (entry) => entry.targetKind === 'catalog' && entry.targetId === catalogName).length;
      expect(count, `catalog entry "${catalogName}"`).toBeGreaterThanOrEqual(2);
    }
  });

  it('defines at least two examples for site-seo panel introspection', () => {
    const count = entries().filter(
      (entry) => entry.targetKind === 'panel' && entry.targetId === 'site-seo').length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('validates every curated example against validateSpec with zero errors', () => {
    const failures: string[] = [];
    const allEntries = entries();

    for (const entry of allEntries) {
      const context = buildValidationContextFromHints(entry.validation, v1CatalogEntries);
      const result = validateSpec(entry.spec, context);
      if (!result.ok) {
        const messages = result.errors.map((issue) => `${issue.code}: ${issue.message}`).join('; ');
        failures.push(`${entry.id} -> ${messages}`);
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
    expect(allEntries.length).toBeGreaterThanOrEqual(26);
  });
});
