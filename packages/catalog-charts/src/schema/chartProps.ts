import { z } from 'zod';

/** One row in a cartesian or pie dataset. Values may be string labels or numeric measures. */
export const chartDataPointSchema = z.record(z.string(), z.union([z.string(), z.number(), z.null()])).describe('Chart row keyed by dimension and measure fields');

export type ChartDataPoint = z.infer<typeof chartDataPointSchema>;

export const chartSeriesSchema = z.object({
  key: z.string().min(1),
  label: z.string().optional(),
  color: z.string().optional(),
});

export type ChartSeries = z.infer<typeof chartSeriesSchema>;

const chartDataBindingSchema = z.object({
  bind: z.string().min(1).optional(),
  data: z.array(chartDataPointSchema).min(1).optional(),
});

function requireDataOrBind<T extends z.ZodRawShape>(
  shape: T,
  refineMessage: string): z.ZodObject<T> {
  return z.object(shape).superRefine((value, ctx) => {
    // The generic raw shape erases field types; bind is a string and data an
    // array wherever this refinement is applied.
    const bind = 'bind' in value ? (value.bind as string | undefined) : undefined;
    const data = 'data' in value ? (value.data as readonly unknown[] | undefined) : undefined;
    if ((bind === undefined || bind.length === 0) && (data === undefined || data.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: refineMessage,
        path: ['data'],
      });
    }
  }) as z.ZodObject<T>;
}

/** Shared cartesian chart props (bar, line, area). */
export const cartesianChartPropsSchema = requireDataOrBind(
  {...chartDataBindingSchema.shape,
    xKey: z.string().min(1).default('label'),
    series: z.array(chartSeriesSchema).min(1).optional(),
    height: z.number().int().positive().max(800).optional(),
    showGrid: z.boolean().optional(),
    showLegend: z.boolean().optional(),
  },
  'Provide inline data or a bind key for cartesian charts');

export type CartesianChartProps = z.infer<typeof cartesianChartPropsSchema>;

export const barChartPropsSchema = cartesianChartPropsSchema;
export type BarChartProps = CartesianChartProps;

export const lineChartPropsSchema = cartesianChartPropsSchema;
export type LineChartProps = CartesianChartProps;

export const areaChartPropsSchema = cartesianChartPropsSchema;
export type AreaChartProps = CartesianChartProps;

/** Pie donut chart props. */
export const pieChartPropsSchema = requireDataOrBind(
  {...chartDataBindingSchema.shape,
    nameKey: z.string().min(1).default('label'),
    valueKey: z.string().min(1).default('value'),
    height: z.number().int().positive().max(800).optional(),
    showLegend: z.boolean().optional(),
    innerRadius: z.number().int().nonnegative().max(200).optional(),
  },
  'Provide inline data or a bind key for pie charts');

export type PieChartProps = z.infer<typeof pieChartPropsSchema>;

/** Parse helpers — throw on invalid agent/host input. */
export function parseBarChartProps(input: unknown): BarChartProps {
  return barChartPropsSchema.parse(input);
}

export function parseLineChartProps(input: unknown): LineChartProps {
  return lineChartPropsSchema.parse(input);
}

export function parseAreaChartProps(input: unknown): AreaChartProps {
  return areaChartPropsSchema.parse(input);
}

export function parsePieChartProps(input: unknown): PieChartProps {
  return pieChartPropsSchema.parse(input);
}
