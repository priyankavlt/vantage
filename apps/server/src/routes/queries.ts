import { savedQuery } from '@vantage/db/schema';
import {
  createSavedQueryRequestSchema,
  queryResultSchema,
  runQueryRequestSchema,
  savedQuerySchema,
  updateSavedQueryRequestSchema,
  type SavedQuery,
} from '@vantage/shared';
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../context';
import { notFound } from '../errors';
import { requireWorkspace } from '../plugins/auth';
import { runForRequest } from '../run-query';
import { findDataSource } from './data-sources';

const workspaceParams = z.object({ workspaceId: z.string() });
const queryParams = workspaceParams.extend({ queryId: z.string() });

type Row = typeof savedQuery.$inferSelect;

const toDto = (row: Row): SavedQuery => ({
  id: row.id,
  name: row.name,
  sql: row.sql,
  dataSourceId: row.dataSourceId,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** Load a saved query, scoped to the workspace in the URL. */
export async function findQuery(ctx: AppContext, workspaceId: string, id: string): Promise<Row> {
  const [row] = await ctx.db
    .select()
    .from(savedQuery)
    .where(and(eq(savedQuery.workspaceId, workspaceId), eq(savedQuery.id, id)))
    .limit(1);
  if (!row) throw notFound('Query');
  return row;
}

export const queryRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = (app, { ctx }) => {
  const guard = requireWorkspace(ctx);
  const base = '/workspaces/:workspaceId/queries';

  /** Run SQL against a data source. Always read-only, time-limited and row-capped. */
  app.post(
    `${base}/run`,
    {
      schema: {
        params: workspaceParams,
        body: runQueryRequestSchema,
        response: { 200: queryResultSchema },
      },
      preHandler: guard,
    },
    async (request, reply) =>
      runForRequest(ctx, request, reply, {
        workspaceId: request.params.workspaceId,
        ...request.body,
      }),
  );

  app.get(
    base,
    {
      schema: { params: workspaceParams, response: { 200: z.array(savedQuerySchema) } },
      preHandler: guard,
    },
    async (request) => {
      const rows = await ctx.db
        .select()
        .from(savedQuery)
        .where(eq(savedQuery.workspaceId, request.params.workspaceId))
        .orderBy(desc(savedQuery.updatedAt));
      return rows.map(toDto);
    },
  );

  app.get(
    `${base}/:queryId`,
    { schema: { params: queryParams, response: { 200: savedQuerySchema } }, preHandler: guard },
    async (request) =>
      toDto(await findQuery(ctx, request.params.workspaceId, request.params.queryId)),
  );

  app.post(
    base,
    {
      schema: {
        params: workspaceParams,
        body: createSavedQueryRequestSchema,
        response: { 201: savedQuerySchema },
      },
      preHandler: guard,
    },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { dataSourceId } = request.body;
      // The data source must belong to this workspace.
      if (dataSourceId) await findDataSource(ctx, workspaceId, dataSourceId);
      const [row] = await ctx.db
        .insert(savedQuery)
        .values({ ...request.body, workspaceId, createdBy: request.user?.id ?? null })
        .returning();
      if (!row) throw new Error('insert returned no row');
      return reply.status(201).send(toDto(row));
    },
  );

  app.patch(
    `${base}/:queryId`,
    {
      schema: {
        params: queryParams,
        body: updateSavedQueryRequestSchema,
        response: { 200: savedQuerySchema },
      },
      preHandler: guard,
    },
    async (request) => {
      const { workspaceId, queryId } = request.params;
      await findQuery(ctx, workspaceId, queryId);
      const { name, sql, dataSourceId } = request.body;
      if (dataSourceId) await findDataSource(ctx, workspaceId, dataSourceId);
      const [row] = await ctx.db
        .update(savedQuery)
        .set({
          ...(name === undefined ? {} : { name }),
          ...(sql === undefined ? {} : { sql }),
          ...(dataSourceId === undefined ? {} : { dataSourceId }),
          updatedAt: new Date(),
        })
        .where(and(eq(savedQuery.workspaceId, workspaceId), eq(savedQuery.id, queryId)))
        .returning();
      if (!row) throw notFound('Query');
      return toDto(row);
    },
  );

  app.delete(
    `${base}/:queryId`,
    { schema: { params: queryParams }, preHandler: guard },
    async (request, reply) => {
      const { workspaceId, queryId } = request.params;
      await findQuery(ctx, workspaceId, queryId);
      await ctx.db
        .delete(savedQuery)
        .where(and(eq(savedQuery.workspaceId, workspaceId), eq(savedQuery.id, queryId)));
      return reply.status(204).send();
    },
  );

  return Promise.resolve();
};
