/**
 * Recharts-backed catalog composites. Read-only presentation;
 * never mutates bound panel data.
 */
import React, { type ReactElement } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SpecNodeContextValue } from '../../../../src/panels/types';
import type {
  AreaChartProps,
  BarChartProps,
  ChartSeries,
  LineChartProps,
  PieChartProps,
} from '../schema/chartProps';
import {
  colorAt,
  DEFAULT_CHART_HEIGHT,
  resolveChartRows,
  resolveNumeric,
  resolveSeriesKeys,
} from './resolveChartData';

interface CatalogComponentProps {
  context?: SpecNodeContextValue;
}

type ChartState = SpecNodeContextValue['state'] | undefined;

function renderChartState(
  state: ChartState,
  children: React.ReactNode): React.ReactElement {
  if (state === 'loading') {
    return <div data-testid="chart-loading">Loading chart…</div>;
  }
  if (state === 'error') {
    return <div data-testid="chart-error" role="alert">Chart data unavailable</div>;
  }
  if (state === 'empty') {
    return <div data-testid="chart-empty">No chart data</div>;
  }
  return <div data-testid="chart-populated">{children}</div>;
}

function ChartFrame({
  state,
  height,
  children,
  testId,
}: {
  state: ChartState;
  height: number;
  /** Single chart element — recharts' ResponsiveContainer requires one. */
  children: React.ReactElement;
  testId: string;
}): ReactElement {
  return (
    <div
      data-testid={testId}
      className="catalog-chart-frame"
      style={{ width: '100%', height }}
      role="img"
      aria-label="Data chart"
    >
      {renderChartState(
        state,
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>)}
    </div>
  );
}

function buildCartesianData(
  props: BarChartProps | LineChartProps | AreaChartProps,
  context: SpecNodeContextValue | undefined): { rows: Record<string, unknown>[]; seriesKeys: string[] } | null {
  const rows = resolveChartRows(props.bind, props.data, context);
  if (rows === null || rows.length === 0) {
    return null;
  }
  const xKey = props.xKey ?? 'label';
  const seriesKeys = resolveSeriesKeys(rows, xKey, props.series);
  if (seriesKeys.length === 0) {
    return null;
  }
  const normalized = rows.map((row) => {
    const next: Record<string, unknown> = { [xKey]: row[xKey] ?? '' };
    for (const key of seriesKeys) {
      next[key] = resolveNumeric(row[key]);
    }
    return next;
  });
  return { rows: normalized, seriesKeys };
}

function seriesMeta(
  keys: readonly string[],
  declared: readonly ChartSeries[] | undefined): ChartSeries[] {
  return keys.map((key, index) => {
    const match = declared?.find((entry) => entry.key === key);
    return {
      key,
      label: match?.label ?? key,
      color: colorAt(index, match?.color),
    };
  });
}

export type BarChartComponentProps = BarChartProps & CatalogComponentProps;
export type LineChartComponentProps = LineChartProps & CatalogComponentProps;
export type AreaChartComponentProps = AreaChartProps & CatalogComponentProps;
export type PieChartComponentProps = PieChartProps & CatalogComponentProps;

export function ChartBar(props: BarChartComponentProps): ReactElement {
  const height = props.height ?? DEFAULT_CHART_HEIGHT;
  const prepared = buildCartesianData(props, props.context);
  if (prepared === null) {
    return <div data-testid="chart-bar" role="note">Chart requires data</div>;
  }
  const xKey = props.xKey ?? 'label';
  const meta = seriesMeta(prepared.seriesKeys, props.series);
  return (
    <ChartFrame state={props.context?.state} height={height} testId="chart-bar">
      <BarChart data={prepared.rows}>
        {props.showGrid !== false ? <CartesianGrid strokeDasharray="3 3" />: null}
        <XAxis dataKey={xKey} />
        <YAxis />
        <Tooltip />
        {props.showLegend !== false ? <Legend />: null}
        {meta.map((entry) => (
          <Bar key={entry.key} dataKey={entry.key} name={entry.label} fill={entry.color} />
        ))}
      </BarChart>
    </ChartFrame>
  );
}

export function ChartLine(props: LineChartComponentProps): ReactElement {
  const height = props.height ?? DEFAULT_CHART_HEIGHT;
  const prepared = buildCartesianData(props, props.context);
  if (prepared === null) {
    return <div data-testid="chart-line" role="note">Chart requires data</div>;
  }
  const xKey = props.xKey ?? 'label';
  const meta = seriesMeta(prepared.seriesKeys, props.series);
  return (
    <ChartFrame state={props.context?.state} height={height} testId="chart-line">
      <LineChart data={prepared.rows}>
        {props.showGrid !== false ? <CartesianGrid strokeDasharray="3 3" />: null}
        <XAxis dataKey={xKey} />
        <YAxis />
        <Tooltip />
        {props.showLegend !== false ? <Legend />: null}
        {meta.map((entry) => (
          <Line
            key={entry.key}
            type="monotone"
            dataKey={entry.key}
            name={entry.label}
            stroke={entry.color}
            dot={false}
          />
        ))}
      </LineChart>
    </ChartFrame>
  );
}

export function ChartArea(props: AreaChartComponentProps): ReactElement {
  const height = props.height ?? DEFAULT_CHART_HEIGHT;
  const prepared = buildCartesianData(props, props.context);
  if (prepared === null) {
    return <div data-testid="chart-area" role="note">Chart requires data</div>;
  }
  const xKey = props.xKey ?? 'label';
  const meta = seriesMeta(prepared.seriesKeys, props.series);
  return (
    <ChartFrame state={props.context?.state} height={height} testId="chart-area">
      <AreaChart data={prepared.rows}>
        {props.showGrid !== false ? <CartesianGrid strokeDasharray="3 3" />: null}
        <XAxis dataKey={xKey} />
        <YAxis />
        <Tooltip />
        {props.showLegend !== false ? <Legend />: null}
        {meta.map((entry) => (
          <Area
            key={entry.key}
            type="monotone"
            dataKey={entry.key}
            name={entry.label}
            stroke={entry.color}
            fill={entry.color}
            fillOpacity={0.25}
          />
        ))}
      </AreaChart>
    </ChartFrame>
  );
}

export function ChartPie(props: PieChartComponentProps): ReactElement {
  const height = props.height ?? DEFAULT_CHART_HEIGHT;
  const nameKey = props.nameKey ?? 'label';
  const valueKey = props.valueKey ?? 'value';
  const rows = resolveChartRows(props.bind, props.data, props.context);
  // Invoke immediately: as a bare function the null-check below never fires
  // and recharts receives the function itself as `data`.
  const slices = (() => {
    if (rows === null) return null;
    const next = rows.map((row) => ({
        name: String(row[nameKey] ?? ''),
        value: resolveNumeric(row[valueKey]),
      })).filter((row) => row.name.length > 0 && row.value !== null) as Array<{
      name: string;
      value: number;
    }>;
    return next.length > 0 ? next: null;
  })();

  if (slices === null) {
    return <div data-testid="chart-pie" role="note">Chart requires data</div>;
  }

  return (
    <ChartFrame state={props.context?.state} height={height} testId="chart-pie">
      <PieChart>
        <Tooltip />
        {props.showLegend !== false ? <Legend />: null}
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          innerRadius={props.innerRadius ?? 0}
          outerRadius="80%"
        >
          {slices.map((slice, index) => (
            <Cell key={slice.name} fill={colorAt(index)} />
          ))}
        </Pie>
      </PieChart>
    </ChartFrame>
  );
}
