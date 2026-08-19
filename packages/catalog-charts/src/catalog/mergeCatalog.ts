import type { CatalogEntry } from '../../../../src/panels/types';
import { chartCatalogEntries } from './entries';

/**
 * Merge chart catalog composites into a host catalog without mutating the base map.
 * Hosts pass the result to `createCanvasHost({ catalog })`.
 */
export function mergeChartsCatalog(
  base: ReadonlyMap<string, CatalogEntry>): ReadonlyMap<string, CatalogEntry> {
  const merged = new Map<string, CatalogEntry>(base);
  for (const [name, entry] of chartCatalogEntries) {
    if (merged.has(name)) {
      throw new Error(`[catalog-charts] catalog name collision: "${name}" already registered`);
    }
    merged.set(name, entry);
  }
  return merged;
}

/** Returns chart entries only — for tests and bundle boundary checks. */
export function createChartsCatalog(): ReadonlyMap<string, CatalogEntry> {
  return new Map(chartCatalogEntries);
}
