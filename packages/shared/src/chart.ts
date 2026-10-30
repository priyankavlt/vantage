import { z } from 'zod';

export const chartTypeSchema = z.enum(['bar', 'line', 'area', 'pie', 'table', 'big-number']);
export type ChartType = z.infer<typeof chartTypeSchema>;

export const CHART_TYPES = chartTypeSchema.options;
