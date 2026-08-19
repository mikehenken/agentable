import { useMemo } from 'react';

import { useOpenPositionsJobs } from '../../../packages/career-pack/src/panels/useOpenPositionsJobs';

import { useCanvasConfig } from '../../config/CanvasContext';

import { useWhiteboardPanelHost } from '../../engines/tldraw/shapes/whiteboardPanelHostBridge';

import { useOptionalPanelEmbedHost } from './PanelEmbedContext';

const CAREER_PANEL_DATA_KEYS = [
  'jobs',
  'applications',
  'growthPaths',
  'resources',
  'featuredResource',
] as const;

function readArray(value: unknown): readonly unknown[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }
  return value as readonly unknown[];
}

/** Coalesce embed panel-data + adapter lifecycle into react panel `data` props. */
export function useEmbedReactPanelData(
  panelId: string,
  panelData: Record<string, unknown> | undefined): Record<string, unknown> {
  const ctx = useOptionalPanelEmbedHost;
  const host = ctx?.().host ?? useWhiteboardPanelHost;
  const lifecycle = host?.data.lifecycle ?? null;
  const { panelData: tenantPanelData } = useCanvasConfig;

  const mergedPanelData = useMemo(() => {
    const base = {...(panelData ?? {}) };
    for (const key of CAREER_PANEL_DATA_KEYS) {
      const shapeValue = base[key];
      const tenantValue = tenantPanelData?.[key];
      if (readArray(shapeValue) === undefined && readArray(tenantValue) !== undefined) {
        base[key] = tenantValue;
      } else if (
        key === 'featuredResource' &&
        base.featuredResource === undefined &&
        tenantPanelData?.featuredResource !== undefined
      ) {
        base.featuredResource = tenantPanelData.featuredResource;
      }
    }
    return base;
  }, [panelData, tenantPanelData]);

  const openPositionsJobs = useOpenPositionsJobs(
    panelId === 'open-positions' ? mergedPanelData: undefined,
    panelId === 'open-positions' ? lifecycle: null);

  return useMemo(() => {
    if (panelId === 'open-positions') {
      return {...mergedPanelData,
        jobs: [...openPositionsJobs],
      };
    }
    return mergedPanelData;
  }, [mergedPanelData, openPositionsJobs, panelId]);
}
