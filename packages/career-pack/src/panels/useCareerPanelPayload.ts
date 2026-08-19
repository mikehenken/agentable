import { useMemo } from 'react';
import type { ReactPanelLoaderProps } from '../../../../src/panels/registry';
import type {
  CareerPanelDataPayload,
  PanelApplicationRow,
  PanelGrowthPathRow,
  PanelResourceRow,
} from '../adapters/careerDatasetToPanelData';

function readArray<T>(value: unknown): readonly T[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [];
  }
  return value as readonly T[];
}

function isPanelRow<T extends { id: string | number }>(
  value: unknown,
): value is T {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' || typeof row.id === 'number';
}

/** Coalesce tenant/shape panel-data for a career react panel bind key. */
export function useCareerPanelPayload<K extends keyof CareerPanelDataPayload>(
  data: ReactPanelLoaderProps['data'],
  key: K,
): CareerPanelDataPayload[K] {
  return useMemo(() => {
    const raw = data?.[key as string];
    const rows = readArray(raw);
    if (rows.length === 0) {
      return undefined;
    }
    if (isPanelRow(rows[0])) {
      return rows as CareerPanelDataPayload[K];
    }
    return undefined;
  }, [data, key]);
}

export function useApplicationsRows(
  data: ReactPanelLoaderProps['data'],
): readonly PanelApplicationRow[] {
  return useCareerPanelPayload(data, 'applications') ?? [];
}

export function useResourcesRows(
  data: ReactPanelLoaderProps['data'],
): readonly PanelResourceRow[] {
  return useCareerPanelPayload(data, 'resources') ?? [];
}

export function useGrowthPathRows(
  data: ReactPanelLoaderProps['data'],
): readonly PanelGrowthPathRow[] {
  return useCareerPanelPayload(data, 'growthPaths') ?? [];
}

export function useFeaturedResource(
  data: ReactPanelLoaderProps['data'],
): PanelResourceRow | undefined {
  const resources = useResourcesRows(data);
  return useMemo(() => {
    const featured = data?.featuredResource;
    if (featured && typeof featured === 'object' && featured !== null) {
      return featured as PanelResourceRow;
    }
    return resources[0];
  }, [data?.featuredResource, resources]);
}
