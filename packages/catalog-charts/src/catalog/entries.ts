import type { CatalogEntry } from '../../../../src/panels/types';
import {
  areaChartPropsSchema,
  barChartPropsSchema,
  lineChartPropsSchema,
  pieChartPropsSchema,
} from '../schema/chartProps';
import { CHART_CATALOG_ENTRY_NAMES } from '../constants';
import { ChartArea, ChartBar, ChartLine, ChartPie } from './components';

export const chartCatalogEntries: ReadonlyMap<string, CatalogEntry> = new Map([
  [
    'chart-bar',
    {
      name: 'chart-bar',
      props: barChartPropsSchema,
      component: ChartBar,
      agentHint: 'Bar chart for categorical comparisons; inline data or bind to charts.series',
    },
  ],
  [
    'chart-line',
    {
      name: 'chart-line',
      props: lineChartPropsSchema,
      component: ChartLine,
      agentHint: 'Line chart for trends over ordered categories or time buckets',
    },
  ],
  [
    'chart-area',
    {
      name: 'chart-area',
      props: areaChartPropsSchema,
      component: ChartArea,
      agentHint: 'Stacked or overlapping area chart for cumulative trends',
    },
  ],
  [
    'chart-pie',
    {
      name: 'chart-pie',
      props: pieChartPropsSchema,
      component: ChartPie,
      agentHint: 'Pie or donut chart for part-to-whole breakdowns',
    },
  ],
]);

const entryNames = [...chartCatalogEntries.keys()];
if (entryNames.join(',') !== CHART_CATALOG_ENTRY_NAMES.join(',')) {
  throw new Error(
    `[catalog-charts] catalog entry drift: expected [${CHART_CATALOG_ENTRY_NAMES.join(', ')}], got [${entryNames.join(', ')}]`);
}

export { chartCatalogEntries as entries };
