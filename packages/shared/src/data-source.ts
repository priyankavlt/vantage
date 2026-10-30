import { z } from 'zod';

export const connectorTypeSchema = z.enum(['postgres']);
export type ConnectorType = z.infer<typeof connectorTypeSchema>;

export const postgresSslModeSchema = z.enum(['disable', 'require', 'verify-full']);
export type PostgresSslMode = z.infer<typeof postgresSslModeSchema>;

/** Decrypted Postgres connection settings. Contains secrets: never send to the browser. */
export const postgresConfigSchema = z.object({
  host: z.string().trim().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65_535).default(5432),
  database: z.string().trim().min(1).max(63),
  user: z.string().trim().min(1).max(63),
  password: z.string().max(1024).default(''),
  ssl: postgresSslModeSchema.default('disable'),
});
export type PostgresConfig = z.infer<typeof postgresConfigSchema>;

export const dataSourceConfigSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('postgres'), config: postgresConfigSchema }),
]);
export type DataSourceConfig = z.infer<typeof dataSourceConfigSchema>;

export const dataSourceNameSchema = z.string().trim().min(1).max(100);

export const createDataSourceRequestSchema = dataSourceConfigSchema.and(
  z.object({ name: dataSourceNameSchema }),
);
export type CreateDataSourceRequest = z.infer<typeof createDataSourceRequestSchema>;

/** What the API returns about a data source. No secrets. */
export const dataSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: connectorTypeSchema,
  host: z.string(),
  database: z.string(),
  createdAt: z.iso.datetime(),
});
export type DataSource = z.infer<typeof dataSourceSchema>;

export const testConnectionResultSchema = z.object({
  ok: z.boolean(),
  serverVersion: z.string().optional(),
  message: z.string().optional(),
  latencyMs: z.number().nonnegative(),
});
export type TestConnectionResult = z.infer<typeof testConnectionResultSchema>;

export const tableColumnSchema = z.object({
  name: z.string(),
  nativeType: z.string(),
  nullable: z.boolean(),
});
export type TableColumn = z.infer<typeof tableColumnSchema>;

export const tableInfoSchema = z.object({
  schema: z.string(),
  name: z.string(),
  kind: z.enum(['table', 'view', 'materialized_view']),
  columns: z.array(tableColumnSchema),
});
export type TableInfo = z.infer<typeof tableInfoSchema>;

export const schemaInfoSchema = z.object({ tables: z.array(tableInfoSchema) });
export type SchemaInfo = z.infer<typeof schemaInfoSchema>;
