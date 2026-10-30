import { z } from 'zod';
import { chartSpecSchema } from './chart';

export const DASHBOARD_COLUMNS = 12;

export const dashboardItemSchema = z.object({
  /** Stable id of the tile (a chart can appear on a dashboard more than once). */
  i: z.string().min(1).max(64),
  chartId: z.string().min(1),
  x: z
    .number()
    .int()
    .min(0)
    .max(DASHBOARD_COLUMNS - 1),
  y: z.number().int().min(0).max(10_000),
  w: z.number().int().min(1).max(DASHBOARD_COLUMNS),
  h: z.number().int().min(1).max(50),
});
export type DashboardItem = z.infer<typeof dashboardItemSchema>;

/** Auto-refresh choices, in seconds. `null` means off. */
export const REFRESH_INTERVALS = [60, 300, 900, 3600] as const;
export const refreshIntervalSchema = z
  .union([z.literal(60), z.literal(300), z.literal(900), z.literal(3600)])
  .nullable();

export const dashboardSchema = z.object({
  id: z.string(),
  name: z.string(),
  refreshIntervalSeconds: refreshIntervalSchema,
  items: z.array(dashboardItemSchema),
  /** Present when the dashboard has a public read-only link. */
  shareToken: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Dashboard = z.infer<typeof dashboardSchema>;

export const dashboardNameSchema = z.string().trim().min(1).max(200);

export const createDashboardRequestSchema = z.object({ name: dashboardNameSchema });

export const updateDashboardRequestSchema = z.object({
  name: dashboardNameSchema.optional(),
  refreshIntervalSeconds: refreshIntervalSchema.optional(),
  items: z.array(dashboardItemSchema).max(50).optional(),
});
export type UpdateDashboardRequest = z.infer<typeof updateDashboardRequestSchema>;

/** What anyone with the share link can see. No ids that unlock anything else. */
export const publicDashboardSchema = z.object({
  name: z.string(),
  refreshIntervalSeconds: refreshIntervalSchema,
  items: z.array(dashboardItemSchema),
  charts: z.array(z.object({ id: z.string(), name: z.string(), spec: chartSpecSchema })),
});
export type PublicDashboard = z.infer<typeof publicDashboardSchema>;
