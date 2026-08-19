import { useEffect, useMemo, useState } from 'react';
import { careerJobsToPanelRows, type PanelJobRow } from '../adapters/careerDatasetToPanelData';
import { inferJobTrack } from './openPositionsTrackLexicon';
import type { CareerJob } from '../types';
import type { ReactPanelLoaderProps } from '../../../../src/panels/registry';
import type { DataLifecycle } from '../../../../src/panels/renderer/types';

function isPanelJobRow(value: unknown): value is PanelJobRow {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return typeof row.id === 'number' && typeof row.title === 'string';
}

function isCareerJob(value: unknown): value is CareerJob {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && typeof row.title === 'string';
}

function normalizeJobRow(row: PanelJobRow): PanelJobRow {
  return {...row,
    track: row.track ?? inferJobTrack(row.type, row.department),
  };
}

function normalizeJobs(raw: readonly unknown[] | undefined): readonly PanelJobRow[] {
  if (!raw?.length) {
    return [];
  }
  if (isPanelJobRow(raw[0])) {
    return (raw as PanelJobRow[]).map(normalizeJobRow);
  }
  if (isCareerJob(raw[0])) {
    return careerJobsToPanelRows(raw as CareerJob[]);
  }
  return [];
}

/** Resolve open-positions rows from panel props or adapter lifecycle. */
export function useOpenPositionsJobs(
  data: ReactPanelLoaderProps['data'],
  lifecycle: DataLifecycle | null): readonly PanelJobRow[] {
  const propJobs = normalizeJobs(data?.jobs as readonly unknown[] | undefined);
  const [adapterJobs, setAdapterJobs] = useState<readonly PanelJobRow[]>([]);

  useEffect(() => {
    if (propJobs.length > 0 || lifecycle === null) {
      setAdapterJobs([]);
      return;
    }

    let handle: ReturnType<DataLifecycle['acquire']> | null = null;
    try {
      handle = lifecycle.acquire({ source: 'career.jobs' }, {});
    } catch {
      setAdapterJobs([]);
      return;
    }

    const sync = (): void => {
      const snapshot = handle!.getSnapshot;
      if (snapshot().status === 'success' && Array.isArray(snapshot().data)) {
        setAdapterJobs(normalizeJobs(snapshot().data as readonly unknown[]));
      }
    };

    sync();
    const unsubscribe = handle.subscribe(sync);
    return () => {
      unsubscribe();
      handle!.release;
    };
  }, [lifecycle, propJobs.length]);

  return useMemo(() => {
    if (propJobs.length > 0) {
      return propJobs;
    }
    return adapterJobs;
  }, [propJobs, adapterJobs]);
}
