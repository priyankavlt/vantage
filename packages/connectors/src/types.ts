import type { ConnectorType, QueryResult, SchemaInfo, TestConnectionResult } from '@vantage/shared';
import type { z } from 'zod';

export type {
  ConnectorType,
  SchemaInfo,
  TableColumn,
  TableInfo,
  TestConnectionResult,
} from '@vantage/shared';

/** Limits that every `execute` call must enforce. Resolved by `resolveQueryLimits`. */
export interface ExecuteOptions {
  timeoutMs: number;
  maxRows: number;
  signal?: AbortSignal;
}

/** An error caused by the user's query or the remote database (safe to show to the user). */
export class QueryError extends Error {
  constructor(
    message: string,
    readonly code: 'QUERY_FAILED' | 'TIMEOUT' | 'CANCELLED' | 'CONNECTION_FAILED',
    readonly position?: number,
  ) {
    super(message);
    this.name = 'QueryError';
  }
}

/** An open connection (usually a pool) to one data source. */
export interface Connection {
  test(): Promise<TestConnectionResult>;
  introspect(): Promise<SchemaInfo>;
  /**
   * Run untrusted, user-written SQL. Implementations MUST:
   * - run inside a read-only transaction or session,
   * - apply `timeoutMs` on the database side (not only client-side),
   * - stop reading after `maxRows` and set `truncated`,
   * - abort when `signal` fires,
   * - reject multiple statements in one call.
   * Failures caused by the query throw `QueryError`.
   */
  execute(sql: string, options: ExecuteOptions): Promise<QueryResult>;
  close(): Promise<void>;
}

export interface ConnectorDefinition<TConfig = unknown> {
  type: ConnectorType;
  displayName: string;
  /** Validates the decrypted connection config. Secrets live inside this config. */
  configSchema: z.ZodType<TConfig>;
  connect(config: TConfig): Connection;
}
