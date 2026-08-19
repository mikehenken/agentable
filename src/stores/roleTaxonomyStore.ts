/**
 * Imperative role taxonomy hook for embed adapters (generic passthrough).
 */
export interface RoleTaxonomyEntry {
  id: string;
  label: string;
  departments: string[];
  synonyms: string[];
}

export interface RoleTaxonomyIndex {
  byId: Map<string, RoleTaxonomyEntry>;
}

let taxonomyEntries: RoleTaxonomyEntry[] = [];

function buildRoleTaxonomyIndex(entries: RoleTaxonomyEntry[]): RoleTaxonomyIndex {
  const byId = new Map<string, RoleTaxonomyEntry>();
  for (const entry of entries) {
    byId.set(entry.id, entry);
  }
  return { byId };
}

let taxonomyIndex: RoleTaxonomyIndex = buildRoleTaxonomyIndex([]);

function isRoleTaxonomyEntry(value: unknown): value is RoleTaxonomyEntry {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as RoleTaxonomyEntry;
  return (
    typeof row.id === 'string' &&
    typeof row.label === 'string' &&
    Array.isArray(row.departments) &&
    Array.isArray(row.synonyms)
  );
}

export function setRoleTaxonomy(entries: readonly unknown[] | undefined): void {
  if (!entries || entries.length === 0) {
    taxonomyEntries = [];
    taxonomyIndex = buildRoleTaxonomyIndex([]);
    return;
  }
  taxonomyEntries = entries.filter(isRoleTaxonomyEntry);
  taxonomyIndex = buildRoleTaxonomyIndex(taxonomyEntries);
}

export function getRoleTaxonomyEntries(): readonly RoleTaxonomyEntry[] {
  return taxonomyEntries;
}

export function getRoleTaxonomyIndex(): RoleTaxonomyIndex {
  return taxonomyIndex;
}
