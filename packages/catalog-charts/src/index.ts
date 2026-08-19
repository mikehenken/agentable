export {
  CHART_CATALOG_ENTRY_NAMES,
  CHART_PANEL_IDS,
  CHART_SOURCE_NAMES,
  type ChartCatalogEntryName,
  type ChartPanelId,
  type ChartSourceName,
} from './constants';

export {
  chartCatalogEntries,
  entries as chartCatalogEntriesArray,
} from './catalog/entries';

export {
  mergeChartsCatalog,
  createChartsCatalog,
} from './catalog/mergeCatalog';

export {
  barChartPropsSchema,
  lineChartPropsSchema,
  areaChartPropsSchema,
  pieChartPropsSchema,
  cartesianChartPropsSchema,
  chartDataPointSchema,
  chartSeriesSchema,
  parseBarChartProps,
  parseLineChartProps,
  parseAreaChartProps,
  parsePieChartProps,
  type BarChartProps,
  type LineChartProps,
  type AreaChartProps,
  type PieChartProps,
  type CartesianChartProps,
  type ChartDataPoint,
  type ChartSeries,
} from './schema/chartProps';

export {
  ChartBar,
  ChartLine,
  ChartArea,
  ChartPie,
} from './catalog/components';

export { CHART_COLORS, colorAt } from './catalog/resolveChartData';

export {
  createChartsPack,
  toChartsHostConfig,
  createChartPanelDefinitions,
  buildComposedChartSpec,
  type ChartsPack,
  type ChartsPackOptions,
} from './pack';

export {
  SAMPLE_JOB_GROWTH_SERIES,
  SAMPLE_OCCUPANCY_SERIES,
  SAMPLE_REVENUE_MIX,
  SAMPLE_CARTESIAN_SERIES,
  SAMPLE_LINE_SERIES,
} from './fixtures/sampleData';

export { CHART_CATALOG_KEYS } from './panels';
