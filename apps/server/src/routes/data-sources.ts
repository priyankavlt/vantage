import { QueryError } from '@vantage/connectors';
import { dataSource } from '@vantage/db/schema';
import {
  connectorTypeSchema,
  createDataSourceRequestSchema,
  dataSourceConfigSchema,
  dataSourceSchema,
  schemaInfoSchema,
  testConnectionResultSchema,
  type DataSource,
} from '@vantage/shared';
import { and, asc, eq } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { secretContext } from '../connections';
import type { AppContext } from '../context';
import { HttpError, notFound } from '../errors';
import { assertRole, requireWorkspace } from '../plugins/auth';

const MANAGE_ROLES = ['owner', 'admin'] as const;

const workspaceParams = z.object({ workspaceId: z.string() });
const dataSourceParams = workspaceParams.extend({ dataSourceId: z.string() });

type Row = typeof dataSource.$inferSelect;

const toDto = (row: Row): DataSource => ({
  id: row.id,
  name: row.name,
  type: connectorTypeSchema.parse(row.type),
  host: row.host,
  database: row.database,
  createdAt: row.createdAt.toISOString(),
});

/** Load a data source, scoped to the workspace in the URL. */
export async function findDataSource(
  ctx: AppContext,
  workspaceId: string,
  id: string,
): Promise<Row> {
  const [row] = await ctx.db
    .select()
    .from(dataSource)
    .where(and(eq(dataSource.workspaceId, workspaceId), eq(dataSource.id, id)))
    .limit(1);
  if (!row) throw notFound('Data source');
  return row;
}

const isUniqueViolation = (e: unknown) =>
  typeof e === 'object' &&
  e !== null &&
  ((e as { code?: unknown }).code === '23505' ||
    (e as { cause?: { code?: unknown } }).cause?.code === '23505');

export const dataSourceRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = (app, { ctx }) => {
  const guard = requireWorkspace(ctx);
  const base = '/workspaces/:workspaceId/data-sources';

  app.get(
    base,
    {
      schema: { params: workspaceParams, response: { 200: z.array(dataSourceSchema) } },
      preHandler: guard,
    },
    async (request) => {
      const rows = await ctx.db
        .select()
        .from(dataSource)
        .where(eq(dataSource.workspaceId, request.params.workspaceId))
        .orderBy(asc(dataSource.name));
      return rows.map(toDto);
    },
  );

  // Test settings before saving. Admin-only: it lets the caller reach network hosts.
  app.post(
    `${base}/test`,
    {
      schema: {
        params: workspaceParams,
        body: dataSourceConfigSchema,
        response: { 200: testConnectionResultSchema },
      },
      preHandler: guard,
    },
    async (request) => {
      assertRole(request, MANAGE_ROLES);
      const connection = ctx.connections.open(request.body.type, request.body.config);
      try {
        return await connection.test();
      } finally {
        await connection.close();
      }
    },
  );

  app.post(
    base,
    {
      schema: {
        params: workspaceParams,
        body: createDataSourceRequestSchema,
        response: { 201: dataSourceSchema },
      },
      preHandler: guard,
    },
    async (request, reply) => {
      assertRole(request, MANAGE_ROLES);
      const { name, type, config } = request.body;

      const connection = ctx.connections.open(type, config);
      const result = await connection.test().finally(() => connection.close());
      if (!result.ok) {
        throw new HttpError(
          400,
          'CONNECTION_FAILED',
          result.message ?? 'Could not connect to the database',
        );
      }

      const id = crypto.randomUUID();
      const workspaceId = request.params.workspaceId;
      try {
        const [row] = await ctx.db
          .insert(dataSource)
          .values({
            id,
            workspaceId,
            name,
            type,
            host: config.host,
            database: config.database,
            encryptedConfig: ctx.secrets.encrypt(
              JSON.stringify(config),
              secretContext({ workspaceId, id }),
            ),
            createdBy: request.user?.id ?? null,
          })
          .returning();
        if (!row) throw new Error('insert returned no row');
        return await reply.status(201).send(toDto(row));
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new HttpError(409, 'CONFLICT', `A data source named "${name}" already exists`);
        }
        throw error;
      }
    },
  );

  app.post(
    `${base}/:dataSourceId/test`,
    {
      schema: { params: dataSourceParams, response: { 200: testConnectionResultSchema } },
      preHandler: guard,
    },
    async (request) => {
      const row = await findDataSource(
        ctx,
        request.params.workspaceId,
        request.params.dataSourceId,
      );
      return ctx.connections.get(row).test();
    },
  );

  app.get(
    `${base}/:dataSourceId/schema`,
    {
      schema: { params: dataSourceParams, response: { 200: schemaInfoSchema } },
      preHandler: guard,
    },
    async (request) => {
      const row = await findDataSource(
        ctx,
        request.params.workspaceId,
        request.params.dataSourceId,
      );
      try {
        return await ctx.connections.get(row).introspect();
      } catch (error) {
        if (error instanceof QueryError) throw new HttpError(502, error.code, error.message);
        throw error;
      }
    },
  );

  app.delete(
    `${base}/:dataSourceId`,
    { schema: { params: dataSourceParams }, preHandler: guard },
    async (request, reply) => {
      assertRole(request, MANAGE_ROLES);
      const row = await findDataSource(
        ctx,
        request.params.workspaceId,
        request.params.dataSourceId,
      );
      await ctx.db.delete(dataSource).where(eq(dataSource.id, row.id));
      await ctx.connections.evict(row.id);
      return reply.status(204).send();
    },
  );

  return Promise.resolve();
};
