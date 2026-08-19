/** Canonical chart catalog composite names (append-only; do not reorder). */
export const CHART_CATALOG_ENTRY_NAMES = [
  'chart-bar',
  'chart-line',
  'chart-area',
  'chart-pie',
] as const;

export type ChartCatalogEntryName = (typeof CHART_CATALOG_ENTRY_NAMES)[number];

/** Example Tier 2 panel blueprints shipped with the charts add-on. */
export const CHART_PANEL_IDS = [
  'chart-bar-demo',
  'chart-line-demo',
  'chart-area-demo',
  'chart-pie-demo',
] as const;

export type ChartPanelId = (typeof CHART_PANEL_IDS)[number];

/** Read-only data source names for bound chart panels (query-only; no mutate). */
export const CHART_SOURCE_NAMES = ['charts.series'] as const;

export type ChartSourceName = (typeof CHART_SOURCE_NAMES)[number];
