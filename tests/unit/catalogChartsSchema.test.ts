/**
 * @agentable/catalog-charts — Zod schema validation suite.
 */
import { describe, expect, it } from 'vitest';
import {
  CHART_CATALOG_ENTRY_NAMES,
  barChartPropsSchema,
  lineChartPropsSchema,
  areaChartPropsSchema,
  pieChartPropsSchema,
  parseBarChartProps,
  parsePieChartProps,
  chartCatalogEntries,
} from '@agentable/catalog-charts';
import { SAMPLE_JOB_GROWTH_SERIES, SAMPLE_REVENUE_MIX } from '@agentable/catalog-charts';

describe('chart prop schemas', () => {
  it('validates bar chart inline data', () => {
    const parsed = parseBarChartProps({
      data: [...SAMPLE_JOB_GROWTH_SERIES],
      xKey: 'label',
      series: [{ key: 'hires' }, { key: 'promotions' }],
    });
    expect(parsed.xKey).toBe('label');
    expect(parsed.data).toHaveLength(4);
  });

  it('validates bind-only cartesian charts', () => {
    expect(
      barChartPropsSchema.safeParse({ bind: 'charts.series', xKey: 'month' }).success).toBe(true);
  });

  it('rejects cartesian charts without data or bind', () => {
    expect(barChartPropsSchema.safeParse({ xKey: 'label' }).success).toBe(false);
    expect(lineChartPropsSchema.safeParse({ data: [] }).success).toBe(false);
    expect(areaChartPropsSchema.safeParse({}).success).toBe(false);
  });

  it('validates pie chart props', () => {
    const parsed = parsePieChartProps({
      data: [...SAMPLE_REVENUE_MIX],
      nameKey: 'label',
      valueKey: 'value',
    });
    expect(parsed.valueKey).toBe('value');
  });

  it('rejects pie charts with invalid innerRadius', () => {
    expect(
      pieChartPropsSchema.safeParse({
        data: SAMPLE_REVENUE_MIX,
        innerRadius: -1,
      }).success).toBe(false);
  });
});

describe('chart catalog entries', () => {
  it('registers four chart composites in stable order', () => {
    expect([...chartCatalogEntries.keys()]).toEqual([...CHART_CATALOG_ENTRY_NAMES]);
    for (const name of CHART_CATALOG_ENTRY_NAMES) {
      const entry = chartCatalogEntries.get(name);
      expect(entry?.name).toBe(name);
      expect(entry?.component).toBeTypeOf('function');
    }
  });

  it('validates props through entry Zod schemas', () => {
    const bar = chartCatalogEntries.get('chart-bar');
    expect(bar?.props.safeParse({ data: SAMPLE_JOB_GROWTH_SERIES }).success).toBe(true);
    const pie = chartCatalogEntries.get('chart-pie');
    expect(pie?.props.safeParse({ data: SAMPLE_REVENUE_MIX }).success).toBe(true);
  });
});
