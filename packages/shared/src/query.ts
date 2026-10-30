import { z } from 'zod';

/**
 * Safety limits for running user-written SQL. Every query against a
 * customer database is untrusted: it always runs with a timeout and a row cap.
 */
export const QUERY_LIMITS = {
  defaultTimeoutMs: 30_000,
  maxTimeoutMs: 300_000,
  defaultMaxRows: 10_000,
  maxRows: 100_000,
} as const;

/** Normalized column types, mapped from each database's native types. */
export const columnTypeSchema = z.enum([
  'string',
  'number',
  'integer',
  'boolean',
  'date',
  'datetime',
  'json',
  'unknown',
]);
export type ColumnType = z.infer<typeof columnTypeSchema>;

export const columnSchema = z.object({
  name: z.string(),
  type: columnTypeSchema,
  /** The type name as reported by the source database, e.g. `timestamptz`. */
  nativeType: z.string(),
});
export type Column = z.infer<typeof columnSchema>;

/** A single cell value after serialization to JSON. */
export const cellValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type CellValue = z.infer<typeof cellValueSchema>;

/** Row-oriented, compact result: `rows[i][j]` is the value of `columns[j]`. */
export const queryResultSchema = z.object({
  columns: z.array(columnSchema),
  rows: z.array(z.array(cellValueSchema)),
  rowCount: z.number().int().nonnegative(),
  /** True when the row cap cut the result short. */
  truncated: z.boolean(),
  durationMs: z.number().nonnegative(),
});
export type QueryResult = z.infer<typeof queryResultSchema>;

export const runQueryRequestSchema = z.object({
  dataSourceId: z.string().min(1),
  sql: z.string().trim().min(1).max(100_000),
  timeoutMs: z.number().int().positive().max(QUERY_LIMITS.maxTimeoutMs).optional(),
  maxRows: z.number().int().positive().max(QUERY_LIMITS.maxRows).optional(),
});
export type RunQueryRequest = z.infer<typeof runQueryRequestSchema>;
