import type { JsonObject, PanelDefinition, PanelSpec } from '../../../src/panels/types';
import { CHART_PANEL_IDS } from './constants';
import {
  SAMPLE_CARTESIAN_SERIES,
  SAMPLE_JOB_GROWTH_SERIES,
  SAMPLE_LINE_SERIES,
  SAMPLE_OCCUPANCY_SERIES,
  SAMPLE_REVENUE_MIX,
} from './fixtures/sampleData';
import type { ChartCatalogEntryName } from './constants';

const SCHEMA_VERSION = 1;

const K = {
  barTitle: 'charts.panels.bar.title',
  barSubtitle: 'charts.panels.bar.subtitle',
  lineTitle: 'charts.panels.line.title',
  lineSubtitle: 'charts.panels.line.subtitle',
  areaTitle: 'charts.panels.area.title',
  areaSubtitle: 'charts.panels.area.subtitle',
  pieTitle: 'charts.panels.pie.title',
  pieSubtitle: 'charts.panels.pie.subtitle',
} as const;

interface ChartPanelBlueprint {
  id: (typeof CHART_PANEL_IDS)[number];
  chartType: ChartCatalogEntryName;
  titleKey: string;
  subtitleKey: string;
  chartProps: JsonObject;
  agentDescription: string;
  defaultSize: { w: number; h: number };
}

function buildChartPanelSpec(
  chartType: ChartCatalogEntryName,
  chartProps: JsonObject): PanelSpec {
  return {
    v: 1,
    origin: 'host',
    root: 'body',
    nodes: {
      body: { type: 'panel-body', children: ['header', 'chart'] },
      header: {
        type: 'header',
        props: { title: K.barTitle, icon: 'BarChart3' },
      },
      chart: {
        type: chartType,
        props: chartProps,
      },
    },
  };
}

function compileChartPanel(blueprint: ChartPanelBlueprint): PanelDefinition {
  const spec = buildChartPanelSpec(blueprint.chartType, blueprint.chartProps);
  spec.nodes.header = {
    type: 'header',
    props: {
      title: blueprint.titleKey,
      subtitle: blueprint.subtitleKey,
      icon: 'BarChart3',
    },
  };
  return {
    kind: 'spec',
    id: blueprint.id,
    meta: {
      title: blueprint.titleKey,
      schemaVersion: SCHEMA_VERSION,
      icon: 'BarChart3',
      agentDescription: blueprint.agentDescription,
      defaultSize: blueprint.defaultSize,
      bodyScroll: 'auto',
    },
    spec,
  };
}

const BLUEPRINTS: readonly ChartPanelBlueprint[] = [
  {
    id: 'chart-bar-demo',
    chartType: 'chart-bar',
    titleKey: K.barTitle,
    subtitleKey: K.barSubtitle,
    chartProps: {
      data: [...SAMPLE_JOB_GROWTH_SERIES],
      xKey: 'label',
      series: [...SAMPLE_CARTESIAN_SERIES],
    },
    agentDescription:
      'Bar chart demo for hiring vs promotions by quarter. Read-only; safe for agent compose_panel with provenance.',
    defaultSize: { w: 560, h: 420 },
  },
  {
    id: 'chart-line-demo',
    chartType: 'chart-line',
    titleKey: K.lineTitle,
    subtitleKey: K.lineSubtitle,
    chartProps: {
      data: [...SAMPLE_OCCUPANCY_SERIES],
      xKey: 'label',
      series: [...SAMPLE_LINE_SERIES],
    },
    agentDescription: 'Line chart demo for occupancy trend. Read-only presentation panel.',
    defaultSize: { w: 560, h: 420 },
  },
  {
    id: 'chart-area-demo',
    chartType: 'chart-area',
    titleKey: K.areaTitle,
    subtitleKey: K.areaSubtitle,
    chartProps: {
      data: [...SAMPLE_OCCUPANCY_SERIES],
      xKey: 'label',
      series: [...SAMPLE_LINE_SERIES],
      showGrid: true,
    },
    agentDescription: 'Area chart demo for cumulative occupancy visualization.',
    defaultSize: { w: 560, h: 420 },
  },
  {
    id: 'chart-pie-demo',
    chartType: 'chart-pie',
    titleKey: K.pieTitle,
    subtitleKey: K.pieSubtitle,
    chartProps: {
      data: [...SAMPLE_REVENUE_MIX],
      nameKey: 'label',
      valueKey: 'value',
    },
    agentDescription: 'Pie chart demo for revenue mix breakdown. Read-only; pinnable composed spec.',
    defaultSize: { w: 480, h: 420 },
  },
];

/**
 * Build an agent-composable chart spec envelope (Tier 3 composed path).
 * Origin is `agent`; hosts validate with mergeChartsCatalog(defaultCatalog).
 */
export function buildComposedChartSpec(input: {
  chartType: ChartCatalogEntryName;
  chartProps: JsonObject;
  title?: string;
  subtitle?: string;
}): PanelSpec {
  const spec = buildChartPanelSpec(input.chartType, input.chartProps);
  spec.origin = 'agent';
  if (input.title !== undefined) {
    spec.nodes.header = {
      type: 'header',
      props: {
        title: input.title,...(input.subtitle !== undefined ? { subtitle: input.subtitle }: {}),
        icon: 'BarChart3',
      },
    };
  }
  return spec;
}

/** Four read-only chart demo panels for host registration. */
export function createChartPanelDefinitions(): readonly PanelDefinition[] {
  const panels = BLUEPRINTS.map(compileChartPanel);
  const ids = panels.map((panel) => panel.id);
  if (ids.join(',') !== CHART_PANEL_IDS.join(',')) {
    throw new Error(
      `[catalog-charts] panel id drift: expected [${CHART_PANEL_IDS.join(', ')}], got [${ids.join(', ')}]`);
  }
  return panels;
}

export { K as CHART_CATALOG_KEYS };
