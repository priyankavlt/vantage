import { randomBytes } from 'node:crypto';
import { chart, dashboard } from '@vantage/db/schema';
import {
  chartColumns,
  createDashboardRequestSchema,
  dashboardItemSchema,
  dashboardSchema,
  publicDashboardSchema,
  queryResultSchema,
  refreshIntervalSchema,
  updateDashboardRequestSchema,
  type Dashboard,
  type QueryResult,
} from '@vantage/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../context';
import { badRequest, HttpError, notFound } from '../errors';
import { assertRole, requireWorkspace } from '../plugins/auth';
import { runForRequest } from '../run-query';
import { RateLimiter } from '../rate-limiter';
import { TtlCache } from '../ttl-cache';
import { findChart, toChartDto } from './charts';
import { findQuery } from './queries';

const PUBLIC_RESULT_TTL_MS = 30_000;
const PUBLIC_REQUESTS_PER_MINUTE = 300;

const chartUnavailable = () =>
  new HttpError(503, 'CHART_UNAVAILABLE', 'This chart is unavailable right now');
const tooManyRequests = () =>
  new HttpError(429, 'RATE_LIMITED', 'Too many requests for this dashboard, try again shortly');

/** Keep only `columns` (in result order). `null` keeps everything. */
export function projectColumns(result: QueryResult, columns: string[] | null): QueryResult {
  if (columns === null) return result;
  const wanted = new Set(columns);
  const keep = result.columns.flatMap((c, i) => (wanted.has(c.name) ? [i] : []));
  return {
    ...result,
    columns: keep.map((i) => result.columns[i]).filter((c) => c !== undefined),
    rows: result.rows.map((row) => keep.map((i) => row[i] ?? null)),
  };
}

const workspaceParams = z.object({ workspaceId: z.string() });
const dashboardParams = workspaceParams.extend({ dashboardId: z.string() });
const tokenParams = z.object({ token: z.string().min(16).max(64) });

type Row = typeof dashboard.$inferSelect;

function parseItems(value: unknown) {
  const parsed = z.array(dashboardItemSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

function parseRefresh(value: number | null) {
  const parsed = refreshIntervalSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const toDto = (row: Row): Dashboard => ({
  id: row.id,
  name: row.name,
  refreshIntervalSeconds: parseRefresh(row.refreshIntervalSeconds),
  items: parseItems(row.items),
  shareToken: row.shareToken,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const dashboardRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = (app, { ctx }) => {
  const guard = requireWorkspace(ctx);
  const base = '/workspaces/:workspaceId/dashboards';
  const publicResults = new TtlCache<QueryResult>(PUBLIC_RESULT_TTL_MS, {
    failureTtlMs: PUBLIC_RESULT_TTL_MS,
  });
  const publicRate = new RateLimiter(PUBLIC_REQUESTS_PER_MINUTE, 60_000);

  async function findDashboard(workspaceId: string, id: string): Promise<Row> {
    const [row] = await ctx.db
      .select()
      .from(dashboard)
      .where(and(eq(dashboard.workspaceId, workspaceId), eq(dashboard.id, id)))
      .limit(1);
    if (!row) throw notFound('Dashboard');
    return row;
  }

  async function update(
    workspaceId: string,
    id: string,
    values: Partial<typeof dashboard.$inferInsert>,
  ) {
    const [row] = await ctx.db
      .update(dashboard)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(dashboard.workspaceId, workspaceId), eq(dashboard.id, id)))
      .returning();
    if (!row) throw notFound('Dashboard');
    return row;
  }

  app.get(
    base,
    {
      schema: { params: workspaceParams, response: { 200: z.array(dashboardSchema) } },
      preHandler: guard,
    },
    async (request) => {
      const rows = await ctx.db
        .select()
        .from(dashboard)
        .where(eq(dashboard.workspaceId, request.params.workspaceId))
        .orderBy(desc(dashboard.updatedAt));
      return rows.map(toDto);
    },
  );

  app.get(
    `${base}/:dashboardId`,
    { schema: { params: dashboardParams, response: { 200: dashboardSchema } }, preHandler: guard },
    async (request) =>
      toDto(await findDashboard(request.params.workspaceId, request.params.dashboardId)),
  );

  app.post(
    base,
    {
      schema: {
        params: workspaceParams,
        body: createDashboardRequestSchema,
        response: { 201: dashboardSchema },
      },
      preHandler: guard,
    },
    async (request, reply) => {
      const [row] = await ctx.db
        .insert(dashboard)
        .values({
          name: request.body.name,
          workspaceId: request.params.workspaceId,
          createdBy: request.user?.id ?? null,
        })
        .returning();
      if (!row) throw new Error('insert returned no row');
      return reply.status(201).send(toDto(row));
    },
  );

  app.patch(
    `${base}/:dashboardId`,
    {
      schema: {
        params: dashboardParams,
        body: updateDashboardRequestSchema,
        response: { 200: dashboardSchema },
      },
      preHandler: guard,
    },
    async (request) => {
      const { workspaceId, dashboardId } = request.params;
      const existing = await findDashboard(workspaceId, dashboardId);
      const { name, refreshIntervalSeconds, items } = request.body;
      if (items) {
        if (new Set(items.map((i) => i.i)).size !== items.length) {
          throw badRequest('Dashboard tile ids must be unique');
        }
        // Every chart on the dashboard must belong to this workspace.
        const chartIds = [...new Set(items.map((i) => i.chartId))];
        if (chartIds.length > 0) {
          const found = await ctx.db
            .select({ id: chart.id })
            .from(chart)
            .where(and(eq(chart.workspaceId, workspaceId), inArray(chart.id, chartIds)));
          if (found.length !== chartIds.length) throw badRequest('Unknown chart on dashboard');
        }
      }
      const row = await update(workspaceId, dashboardId, {
        ...(name === undefined ? {} : { name }),
        ...(refreshIntervalSeconds === undefined ? {} : { refreshIntervalSeconds }),
        ...(items === undefined ? {} : { items }),
      });
      if (existing.shareToken) publicResults.delete(`${existing.shareToken}:`);
      return toDto(row);
    },
  );

  app.delete(
    `${base}/:dashboardId`,
    { schema: { params: dashboardParams }, preHandler: guard },
    async (request, reply) => {
      const { workspaceId, dashboardId } = request.params;
      const row = await findDashboard(workspaceId, dashboardId);
      await ctx.db.delete(dashboard).where(eq(dashboard.id, row.id));
      if (row.shareToken) publicResults.delete(`${row.shareToken}:`);
      return reply.status(204).send();
    },
  );

  /** Create (or rotate) the public read-only link. */
  app.post(
    `${base}/:dashboardId/share`,
    { schema: { params: dashboardParams, response: { 200: dashboardSchema } }, preHandler: guard },
    async (request) => {
      // Public links outlive a member's access, so only owners and admins may publish them.
      assertRole(request, ['owner', 'admin']);
      const { workspaceId, dashboardId } = request.params;
      const existing = await findDashboard(workspaceId, dashboardId);
      if (existing.shareToken) publicResults.delete(`${existing.shareToken}:`);
      const row = await update(workspaceId, dashboardId, {
        shareToken: randomBytes(24).toString('base64url'),
      });
      return toDto(row);
    },
  );

  /** Revoke the public link. Old links stop working immediately. */
  app.delete(
    `${base}/:dashboardId/share`,
    { schema: { params: dashboardParams, response: { 200: dashboardSchema } }, preHandler: guard },
    async (request) => {
      assertRole(request, ['owner', 'admin']);
      const { workspaceId, dashboardId } = request.params;
      const existing = await findDashboard(workspaceId, dashboardId);
      if (existing.shareToken) publicResults.delete(`${existing.shareToken}:`);
      return toDto(await update(workspaceId, dashboardId, { shareToken: null }));
    },
  );

  // ---- Public, unauthenticated routes. Only reachable with a valid share token. ----

  async function findShared(token: string): Promise<Row> {
    const [row] = await ctx.db
      .select()
      .from(dashboard)
      .where(eq(dashboard.shareToken, token))
      .limit(1);
    if (!row) throw notFound('Dashboard');
    return row;
  }

  app.get(
    '/public/dashboards/:token',
    { schema: { params: tokenParams, response: { 200: publicDashboardSchema } } },
    async (request) => {
      if (!publicRate.hit(request.params.token)) throw tooManyRequests();
      const row = await findShared(request.params.token);
      const items = parseItems(row.items);
      const chartIds = [...new Set(items.map((i) => i.chartId))];
      const charts =
        chartIds.length === 0
          ? []
          : await ctx.db
              .select()
              .from(chart)
              .where(and(eq(chart.workspaceId, row.workspaceId), inArray(chart.id, chartIds)));
      return {
        name: row.name,
        refreshIntervalSeconds: parseRefresh(row.refreshIntervalSeconds),
        items,
        charts: charts.map((c) => {
          const { id, name, spec } = toChartDto(c);
          return { id, name, spec };
        }),
      };
    },
  );

  app.get(
    '/public/dashboards/:token/charts/:chartId/data',
    {
      schema: {
        params: tokenParams.extend({ chartId: z.string() }),
        response: { 200: queryResultSchema },
      },
    },
    async (request, reply) => {
      const { token, chartId } = request.params;
      if (!publicRate.hit(token)) throw tooManyRequests();
      const row = await findShared(token);
      // Only charts placed on this dashboard can be read through its link.
      if (!parseItems(row.items).some((i) => i.chartId === chartId)) throw notFound('Chart');
      const c = await findChart(ctx, row.workspaceId, chartId);
      const query = await findQuery(ctx, row.workspaceId, c.queryId);
      const dataSourceId = query.dataSourceId;
      if (!dataSourceId) throw chartUnavailable();
      const columns = chartColumns(toChartDto(c).spec);

      // Cached (successes and failures) so a busy or abusive link can't hammer the database.
      const key = `${token}:${chartId}:${query.updatedAt.getTime()}:${c.updatedAt.getTime()}`;
      try {
        return await publicResults.get(key, async () =>
          // Only the columns the chart draws leave the server.
          projectColumns(
            await runForRequest(ctx, request, reply, {
              workspaceId: row.workspaceId,
              dataSourceId,
              sql: query.sql,
              cancelOnDisconnect: false,
              pool: 'public',
            }),
            columns,
          ),
        );
      } catch (error) {
        // Never show database errors (hostnames, values) to anonymous viewers.
        request.log.warn({ err: error, chartId }, 'public chart failed');
        throw chartUnavailable();
      }
    },
  );

  return Promise.resolve();
};
