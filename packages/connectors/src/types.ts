import type { QueryResult } from '@vantage/shared';
import type { z } from 'zod';

/** Every database Vantage can talk to. Add new ones here and in the registry. */
export type ConnectorType = 'postgres';

export interface TableColumn {
  name: string;
  nativeType: string;
  nullable: boolean;
}

export interface TableInfo {
  schema: string;
  name: string;
  kind: 'table' | 'view' | 'materialized_view';
  columns: TableColumn[];
}

export interface SchemaInfo {
  tables: TableInfo[];
}

export interface TestConnectionResult {
  ok: boolean;
  /** Server version string when the connection worked. */
  serverVersion?: string;
  /** Human-readable reason when it did not. Never includes credentials. */
  message?: string;
  latencyMs: number;
}

/** Limits that every `execute` call must enforce. Resolved by `resolveQueryLimits`. */
export interface ExecuteOptions {
  timeoutMs: number;
  maxRows: number;
  signal?: AbortSignal;
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
   * - abort when `signal` fires.
   */
  execute(sql: string, options: ExecuteOptions): Promise<QueryResult>;
  close(): Promise<void>;
}

export interface ConnectorDefinition<TConfig = unknown> {
  type: ConnectorType;
  displayName: string;
  /** Validates the decrypted connection config. Secrets live inside this config. */
  configSchema: z.ZodType<TConfig>;
  connect(config: TConfig): Promise<Connection>;
}
