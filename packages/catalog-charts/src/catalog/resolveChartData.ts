/**
 * Resolve inline chart data or rows bound through SpecRenderer context.
 * Charts are read-only: this helper never mutates panel data.
 */
import type { SpecNodeContextValue } from '../../../../src/panels/types';
import type { ChartDataPoint } from '../schema/chartProps';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function extractRows(value: unknown): ChartDataPoint[] | null {
  if (Array.isArray(value)) {
    return value.filter(isRecord) as ChartDataPoint[];
  }
  if (isRecord(value) && Array.isArray(value.rows)) {
    return value.rows.filter(isRecord) as ChartDataPoint[];
  }
  return null;
}

export function resolveChartRows(
  bind: string | undefined,
  inlineData: readonly ChartDataPoint[] | undefined,
  context: SpecNodeContextValue | undefined): ChartDataPoint[] | null {
  if (inlineData !== undefined && inlineData.length > 0) {
    return [...inlineData];
  }
  if (bind === undefined || bind.length === 0) {
    return null;
  }
  const bound = context?.data[bind];
  return extractRows(bound);
}

export function resolveNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed: null;
  }
  return null;
}

export function resolveSeriesKeys(
  data: readonly ChartDataPoint[],
  xKey: string,
  series: readonly { key: string }[] | undefined): string[] {
  if (series !== undefined && series.length > 0) {
    return series.map((entry) => entry.key);
  }
  const first = data[0];
  if (first === undefined) {
    return [];
  }
  return Object.keys(first).filter((key) => key !== xKey);
}

export const DEFAULT_CHART_HEIGHT = 280;

/**
 * Categorical series palette. Each slot reads a `--chart-N` custom property
 * (any valid CSS color) so hosts can re-theme, with a literal fallback so
 * charts render distinct hues even when no host CSS defines the tokens.
 * Fallback order is validated for adjacent-pair colorblind separation on
 * light surfaces; identity never rides on color alone because every chart
 * ships a legend and tooltip.
 */
export const CHART_COLORS = [
  'var(--chart-1, #2a78d6)',
  'var(--chart-2, #eb6834)',
  'var(--chart-3, #1baf7a)',
  'var(--chart-4, #eda100)',
  'var(--chart-5, #e87ba4)',
] as const;

export function colorAt(index: number, override?: string): string {
  if (override !== undefined && override.length > 0) {
    return override;
  }
  return CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0];
}
