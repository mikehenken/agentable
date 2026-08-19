import type { PanelDefinition } from '../../../src/panels/types';
import { defaultCatalog } from '../../../src/panels/spec';
import { CHART_SOURCE_NAMES } from './constants';
import { mergeChartsCatalog } from './catalog/mergeCatalog';
import { createChartPanelDefinitions } from './panels';

export interface ChartsPack {
  readonly panels: readonly PanelDefinition[];
  readonly panelIds: readonly string[];
  readonly catalog: ReadonlyMap<string, import('../../../src/panels/types').CatalogEntry>;
  readonly adapterSources: readonly (typeof CHART_SOURCE_NAMES)[number][];
}

export interface ChartsPackOptions {
  /** When true, merge chart entries onto defaultCatalog; otherwise chart entries only. */
  includeDefaultCatalog?: boolean;
}

/**
 * Create the charts add-on pack. Opt-in: hosts import this package
 * explicitly; core whiteboard bundle does not reference it.
 */
export function createChartsPack(options: ChartsPackOptions = {}): ChartsPack {
  const panels = createChartPanelDefinitions();
  const baseCatalog = options.includeDefaultCatalog === false ? new Map() : defaultCatalog;
  const catalog = mergeChartsCatalog(baseCatalog);
  return Object.freeze({
    panels,
    panelIds: panels.map((panel) => panel.id),
    catalog,
    adapterSources: CHART_SOURCE_NAMES,
  });
}

/** React/embed host registration slice. */
export function toChartsHostConfig(pack: ChartsPack): {
  panels: ChartsPack['panels'];
  panelIds: ChartsPack['panelIds'];
  catalog: ChartsPack['catalog'];
} {
  return {
    panels: pack.panels,
    panelIds: pack.panelIds,
    catalog: pack.catalog,
  };
}

export { createChartPanelDefinitions, buildComposedChartSpec } from './panels';
