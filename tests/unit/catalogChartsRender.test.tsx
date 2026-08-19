/**
 * chart composite render smoke (recharts mocked).
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  CHART_COLORS,
  ChartBar,
  ChartLine,
  ChartArea,
  ChartPie,
  colorAt,
  createChartsPack,
  SAMPLE_JOB_GROWTH_SERIES,
  SAMPLE_OCCUPANCY_SERIES,
  SAMPLE_REVENUE_MIX,
} from '@agentable/catalog-charts';
import { validateSpec } from '../../src/panels/spec';
import type { SpecNodeContextValue } from '../../src/panels/types';

vi.mock('recharts', () => {
  const MockContainer = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="recharts-responsive">{children}</div>
  );
  const passthrough =
    (tag: string) =>
    (props: Record<string, unknown>): React.ReactElement =>
      React.createElement(tag, { 'data-testid': tag,...props });
  return {
    ResponsiveContainer: MockContainer,
    BarChart: passthrough('mock-bar-chart'),
    LineChart: passthrough('mock-line-chart'),
    AreaChart: passthrough('mock-area-chart'),
    PieChart: passthrough('mock-pie-chart'),
    Bar: passthrough('mock-bar'),
    Line: passthrough('mock-line'),
    Area: passthrough('mock-area'),
    Pie: passthrough('mock-pie'),
    Cell: passthrough('mock-cell'),
    XAxis: passthrough('mock-x-axis'),
    YAxis: passthrough('mock-y-axis'),
    CartesianGrid: passthrough('mock-grid'),
    Tooltip: passthrough('mock-tooltip'),
    Legend: passthrough('mock-legend'),
  };
});

const populatedContext: SpecNodeContextValue = {
  scope: {},
  data: {},
  dispatch: () => undefined,
  isDirty: false,
  setDirty: () => undefined,
  state: 'populated',
};

describe('chart catalog components (smoke)', () => {
  it('renders bar chart with inline data', () => {
    render(
      <ChartBar
        data={[...SAMPLE_JOB_GROWTH_SERIES]}
        xKey="label"
        series={[{ key: 'hires' }]}
        context={populatedContext}
      />);
    expect(screen.getByTestId('chart-bar')).toBeTruthy();
    expect(screen.getByTestId('recharts-responsive')).toBeTruthy();
    expect(screen.getByTestId('mock-bar-chart')).toBeTruthy();
  });

  it('renders line and area charts', () => {
    render(
      <>
        <ChartLine
          data={[...SAMPLE_OCCUPANCY_SERIES]}
          xKey="label"
          series={[{ key: 'occupancy' }]}
          context={populatedContext}
        />
        <ChartArea
          data={[...SAMPLE_OCCUPANCY_SERIES]}
          xKey="label"
          series={[{ key: 'occupancy' }]}
          context={populatedContext}
        />
      </>);
    expect(screen.getByTestId('chart-line')).toBeTruthy();
    expect(screen.getByTestId('chart-area')).toBeTruthy();
  });

  it('renders pie chart slices', () => {
    render(
      <ChartPie
        data={[...SAMPLE_REVENUE_MIX]}
        nameKey="label"
        valueKey="value"
        context={populatedContext}
      />);
    expect(screen.getByTestId('chart-pie')).toBeTruthy();
    expect(screen.getByTestId('mock-pie-chart')).toBeTruthy();
  });

  it('does not mutate context data when binding', () => {
    const data = { series: [...SAMPLE_JOB_GROWTH_SERIES] };
    const snapshot = JSON.stringify(data);
    const context: SpecNodeContextValue = {...populatedContext,
      data,
    };
    render(
      <ChartBar bind="series" xKey="label" series={[{ key: 'hires' }]} context={context} />);
    expect(JSON.stringify(data)).toBe(snapshot);
  });
});

describe('series colors', () => {
   Regression: CHART_COLORS / once / referenced --/ chart-N / custom / properties / that
   no / stylesheet / defined, so / every / series / resolved / to / the / same / fallback
   color in the / browser. Each / palette / entry / must / carry / a / literal / color / that
   renders / without / any / host / CSS, and / entries / must / stay / distinct.
  it('gives every palette slot a self-contained literal fallback, all distinct', () => {
    const fallbacks = CHART_COLORS.map((entry) => {
      expect(entry).toMatch(/^var\(--chart-[1-5], #[0-9a-f]{6}\)$/);
      return /#[0-9a-f]{6}/.exec(entry)![0];
    });
    expect(new Set(fallbacks).size).toBe(CHART_COLORS.length);
  });

  it('renders a two-series bar chart with distinct renderable fills', () => {
    render(
      <ChartBar
        data={[...SAMPLE_JOB_GROWTH_SERIES]}
        xKey="label"
        series={[{ key: 'hires' }, { key: 'promotions' }]}
        context={populatedContext}
      />);
    const fills = screen.getAllByTestId('mock-bar').map((bar) => bar.getAttribute('fill'));
    expect(fills).toHaveLength(2);
    expect(new Set(fills).size).toBe(2);
    for (const fill of fills) {
      expect(fill).toMatch(/#[0-9a-f]{6}/);
    }
  });

  it('renders pie slices with distinct fills', () => {
    render(
      <ChartPie
        data={[...SAMPLE_REVENUE_MIX]}
        nameKey="label"
        valueKey="value"
        context={populatedContext}
      />);
    const fills = screen.getAllByTestId('mock-cell').map((cell) => cell.getAttribute('fill'));
    expect(fills.length).toBeGreaterThanOrEqual(4);
    expect(new Set(fills).size).toBe(fills.length);
  });

  it('honors an explicit series color override and cycles slots', () => {
    expect(colorAt(0, '#123456')).toBe('#123456');
    expect(colorAt(0)).toBe(CHART_COLORS[0]);
    expect(colorAt(CHART_COLORS.length)).toBe(CHART_COLORS[0]);
  });
});

describe('createChartsPack panel validation', () => {
  it('validates all demo panels against merged catalog', () => {
    const pack = createChartsPack();
    for (const panel of pack.panels) {
      if (panel.kind !== 'spec') continue;
      const result = validateSpec(panel.spec, {
        catalog: pack.catalog,
        adapterSources: new Set(pack.adapterSources),
        hostActions: new Set(),
        panelRegistry: new Set(pack.panelIds),
      });
      expect(result.ok, `validateSpec failed for ${panel.id}`).toBe(true);
    }
  });
});
