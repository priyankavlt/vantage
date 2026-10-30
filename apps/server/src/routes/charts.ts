import { chart } from '@vantage/db/schema';
import {
  chartSchema,
  chartSpecSchema,
  createChartRequestSchema,
  queryResultSchema,
  updateChartRequestSchema,
  type Chart,
} from '@vantage/shared';
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../context';
import { HttpError, notFound } from '../errors';
import { requireWorkspace } from '../plugins/auth';
import { runForRequest } from '../run-query';
import { findQuery } from './queries';

const workspaceParams = z.object({ workspaceId: z.string() });
const chartParams = workspaceParams.extend({ chartId: z.string() });

type Row = typeof chart.$inferSelect;

export function toChartDto(row: Row): Chart {
  // Specs are validated on write; fall back to a table if an old spec no longer parses.
  const spec = chartSpecSchema.safeParse(row.spec);
  return {
    id: row.id,
    name: row.name,
    queryId: row.queryId,
    spec: spec.success ? spec.data : { type: 'table', config: {} },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findChart(ctx: AppContext, workspaceId: string, id: string): Promise<Row> {
  const [row] = await ctx.db
    .select()
    .from(chart)
    .where(and(eq(chart.workspaceId, workspaceId), eq(chart.id, id)))
    .limit(1);
  if (!row) throw notFound('Chart');
  return row;
}

export const chartRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = (app, { ctx }) => {
  const guard = requireWorkspace(ctx);
  const base = '/workspaces/:workspaceId/charts';

  app.get(
    base,
    {
      schema: { params: workspaceParams, response: { 200: z.array(chartSchema) } },
      preHandler: guard,
    },
    async (request) => {
      const rows = await ctx.db
        .select()
        .from(chart)
        .where(eq(chart.workspaceId, request.params.workspaceId))
        .orderBy(desc(chart.updatedAt));
      return rows.map(toChartDto);
    },
  );

  app.get(
    `${base}/:chartId`,
    { schema: { params: chartParams, response: { 200: chartSchema } }, preHandler: guard },
    async (request) =>
      toChartDto(await findChart(ctx, request.params.workspaceId, request.params.chartId)),
  );

  /** Run the chart's saved query and return its rows. */
  app.get(
    `${base}/:chartId/data`,
    { schema: { params: chartParams, response: { 200: queryResultSchema } }, preHandler: guard },
    async (request, reply) => {
      const { workspaceId, chartId } = request.params;
      const row = await findChart(ctx, workspaceId, chartId);
      const query = await findQuery(ctx, workspaceId, row.queryId);
      if (!query.dataSourceId) {
        throw new HttpError(400, 'NO_DATA_SOURCE', "This chart's query has no data source");
      }
      return runForRequest(ctx, request, reply, {
        workspaceId,
        dataSourceId: query.dataSourceId,
        sql: query.sql,
      });
    },
  );

  app.post(
    base,
    {
      schema: {
        params: workspaceParams,
        body: createChartRequestSchema,
        response: { 201: chartSchema },
      },
      preHandler: guard,
    },
    async (request, reply) => {
      const { workspaceId } = request.params;
      await findQuery(ctx, workspaceId, request.body.queryId);
      const [row] = await ctx.db
        .insert(chart)
        .values({ ...request.body, workspaceId, createdBy: request.user?.id ?? null })
        .returning();
      if (!row) throw new Error('insert returned no row');
      return reply.status(201).send(toChartDto(row));
    },
  );

  app.patch(
    `${base}/:chartId`,
    {
      schema: {
        params: chartParams,
        body: updateChartRequestSchema,
        response: { 200: chartSchema },
      },
      preHandler: guard,
    },
    async (request) => {
      const { workspaceId, chartId } = request.params;
      await findChart(ctx, workspaceId, chartId);
      const { name, spec } = request.body;
      const [row] = await ctx.db
        .update(chart)
        .set({
          ...(name === undefined ? {} : { name }),
          ...(spec === undefined ? {} : { spec }),
          updatedAt: new Date(),
        })
        .where(and(eq(chart.workspaceId, workspaceId), eq(chart.id, chartId)))
        .returning();
      if (!row) throw notFound('Chart');
      return toChartDto(row);
    },
  );

  app.delete(
    `${base}/:chartId`,
    { schema: { params: chartParams }, preHandler: guard },
    async (request, reply) => {
      const { workspaceId, chartId } = request.params;
      await findChart(ctx, workspaceId, chartId);
      await ctx.db
        .delete(chart)
        .where(and(eq(chart.workspaceId, workspaceId), eq(chart.id, chartId)));
      return reply.status(204).send();
    },
  );

  return Promise.resolve();
};
