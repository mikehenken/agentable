/** Sample datasets for demos, tests, and curated agent examples. */
import { CHART_COLORS } from '../catalog/resolveChartData';
import type { ChartDataPoint } from '../schema/chartProps';

export const SAMPLE_JOB_GROWTH_SERIES: readonly ChartDataPoint[] = [
  { label: 'Q1', hires: 12, promotions: 4 },
  { label: 'Q2', hires: 18, promotions: 6 },
  { label: 'Q3', hires: 15, promotions: 8 },
  { label: 'Q4', hires: 22, promotions: 9 },
];

export const SAMPLE_OCCUPANCY_SERIES: readonly ChartDataPoint[] = [
  { label: 'Jan', occupancy: 72 },
  { label: 'Feb', occupancy: 78 },
  { label: 'Mar', occupancy: 85 },
  { label: 'Apr', occupancy: 91 },
];

export const SAMPLE_REVENUE_MIX: readonly ChartDataPoint[] = [
  { label: 'Rooms', value: 48 },
  { label: 'Dining', value: 22 },
  { label: 'Spa', value: 15 },
  { label: 'Activities', value: 15 },
];

export const SAMPLE_CARTESIAN_SERIES = [
  { key: 'hires', label: 'Hires', color: CHART_COLORS[0] },
  { key: 'promotions', label: 'Promotions', color: CHART_COLORS[1] },
] as const;

export const SAMPLE_LINE_SERIES = [
  { key: 'occupancy', label: 'Occupancy %', color: CHART_COLORS[2] },
] as const;
