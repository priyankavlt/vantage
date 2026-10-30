import { z } from 'zod';

export const chartTypeSchema = z.enum(['bar', 'line', 'area', 'pie', 'table', 'big-number']);
export type ChartType = z.infer<typeof chartTypeSchema>;

export const CHART_TYPES = chartTypeSchema.options;

const column = z.string().min(1).max(200);

/** Bar, line and area: one x column, one or more y columns, optional split-by column. */
export const cartesianConfigSchema = z.object({
  x: column,
  y: z.array(column).min(1).max(8),
  /** Pivot rows into one series per value of this column (instead of multiple y columns). */
  series: column.optional(),
  stacked: z.boolean().default(false),
});
export type CartesianConfig = z.infer<typeof cartesianConfigSchema>;

export const pieConfigSchema = z.object({ label: column, value: column });
export type PieConfig = z.infer<typeof pieConfigSchema>;

export const bigNumberConfigSchema = z.object({
  value: column,
  /** Optional caption under the number. */
  caption: z.string().max(200).optional(),
});
export type BigNumberConfig = z.infer<typeof bigNumberConfigSchema>;

export const tableConfigSchema = z.object({});

/** Type + its config, validated together. */
export const chartSpecSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bar'), config: cartesianConfigSchema }),
  z.object({ type: z.literal('line'), config: cartesianConfigSchema }),
  z.object({ type: z.literal('area'), config: cartesianConfigSchema }),
  z.object({ type: z.literal('pie'), config: pieConfigSchema }),
  z.object({ type: z.literal('table'), config: tableConfigSchema }),
  z.object({ type: z.literal('big-number'), config: bigNumberConfigSchema }),
]);
export type ChartSpec = z.infer<typeof chartSpecSchema>;

export const chartSchema = z.object({
  id: z.string(),
  name: z.string(),
  queryId: z.string(),
  spec: chartSpecSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Chart = z.infer<typeof chartSchema>;

export const chartNameSchema = z.string().trim().min(1).max(200);

export const createChartRequestSchema = z.object({
  name: chartNameSchema,
  queryId: z.string().min(1),
  spec: chartSpecSchema,
});
export type CreateChartRequest = z.infer<typeof createChartRequestSchema>;

export const updateChartRequestSchema = z.object({
  name: chartNameSchema.optional(),
  spec: chartSpecSchema.optional(),
});
export type UpdateChartRequest = z.infer<typeof updateChartRequestSchema>;
