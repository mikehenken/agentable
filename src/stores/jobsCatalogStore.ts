/**
 * Imperative jobs catalog hook for embed adapters (generic shape guard).
 */
export interface CatalogJob {
  id: number;
  title: string;
  department: string;
}

let catalogJobs: CatalogJob[] = [];

export function setJobsCatalog(jobs: readonly unknown[] | undefined): void {
  if (!jobs || jobs.length === 0) {
    catalogJobs = [];
    return;
  }
  catalogJobs = jobs.filter(
    (j): j is CatalogJob =>
      typeof j === 'object' &&
      j !== null &&
      typeof (j as CatalogJob).id === 'number' &&
      typeof (j as CatalogJob).title === 'string' &&
      typeof (j as CatalogJob).department === 'string');
}

export function getJobsCatalog(): readonly CatalogJob[] {
  return catalogJobs;
}
