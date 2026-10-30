import { QueryError, resolveQueryLimits } from '@vantage/connectors';
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
import { HttpError, notFound } from '../errors';
import { ConcurrencyLimiter } from '../limiter';
import { requireWorkspace } from '../plugins/auth';
import { findDataSource } from './data-sources';

const MAX_CONCURRENT_QUERIES_PER_WORKSPACE = 5;

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

const STATUS_FOR: Record<QueryError['code'], number> = {
  QUERY_FAILED: 400,
  TIMEOUT: 408,
  CANCELLED: 499,
  CONNECTION_FAILED: 502,
};

export const queryRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = (app, { ctx }) => {
  const guard = requireWorkspace(ctx);
  const limiter = new ConcurrencyLimiter(MAX_CONCURRENT_QUERIES_PER_WORKSPACE);
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
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { dataSourceId, sql, timeoutMs, maxRows } = request.body;
      const row = await findDataSource(ctx, workspaceId, dataSourceId);

      const release = limiter.tryAcquire(workspaceId);
      if (!release) {
        throw new HttpError(
          429,
          'TOO_MANY_QUERIES',
          `At most ${MAX_CONCURRENT_QUERIES_PER_WORKSPACE} queries can run at once in a workspace`,
        );
      }
      // Stop the query on the database if the browser goes away.
      const controller = new AbortController();
      const onClose = () => {
        if (!reply.raw.writableEnded) controller.abort();
      };
      request.raw.socket.once('close', onClose);
      try {
        return await ctx.connections
          .get(row)
          .execute(sql, resolveQueryLimits({ timeoutMs, maxRows, signal: controller.signal }));
      } catch (error) {
        if (error instanceof QueryError) {
          throw new HttpError(
            STATUS_FOR[error.code],
            error.code,
            error.message,
            error.position === undefined ? undefined : { position: error.position },
          );
        }
        throw error;
      } finally {
        request.raw.socket.off('close', onClose);
        release();
      }
    },
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

  async function findQuery(workspaceId: string, id: string): Promise<Row> {
    const [row] = await ctx.db
      .select()
      .from(savedQuery)
      .where(and(eq(savedQuery.workspaceId, workspaceId), eq(savedQuery.id, id)))
      .limit(1);
    if (!row) throw notFound('Query');
    return row;
  }

  app.get(
    `${base}/:queryId`,
    { schema: { params: queryParams, response: { 200: savedQuerySchema } }, preHandler: guard },
    async (request) => toDto(await findQuery(request.params.workspaceId, request.params.queryId)),
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
      await findQuery(workspaceId, queryId);
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
      await findQuery(workspaceId, queryId);
      await ctx.db
        .delete(savedQuery)
        .where(and(eq(savedQuery.workspaceId, workspaceId), eq(savedQuery.id, queryId)));
      return reply.status(204).send();
    },
  );

  return Promise.resolve();
};
