import {
  QUERY_LIMITS,
  type PostgresConfig,
  type QueryResult,
  type TableInfo,
} from '@vantage/shared';
import pg from 'pg';
import Cursor from 'pg-cursor';
import { QueryError, type Connection, type ExecuteOptions, type SchemaInfo } from '../types';
import { describeOid, toCell } from './types';

const INTROSPECTION_TIMEOUT_MS = 20_000;
const MAX_INTROSPECTED_COLUMNS = 50_000;

function sslOption(mode: PostgresConfig['ssl']): pg.PoolConfig['ssl'] {
  switch (mode) {
    case 'disable':
      return false;
    case 'require':
      // Encrypted, but the server certificate is not verified (like libpq sslmode=require).
      return { rejectUnauthorized: false };
    case 'verify-full':
      return { rejectUnauthorized: true };
  }
}

interface PgError {
  code?: string;
  message: string;
  position?: string;
}

const isPgError = (e: unknown): e is PgError =>
  e instanceof Error && typeof (e as { code?: unknown }).code === 'string';

/** Messages from the remote server or the network. Never contain the password. */
function toQueryError(error: unknown, cancelled: boolean): QueryError {
  if (error instanceof QueryError) return error;
  if (isPgError(error)) {
    if (error.code === '57014') {
      return cancelled
        ? new QueryError('Query cancelled', 'CANCELLED')
        : new QueryError('Query timed out', 'TIMEOUT');
    }
    if (error.code === '25006') {
      return new QueryError(
        'Vantage runs queries read-only. Statements that change data are not allowed.',
        'QUERY_FAILED',
      );
    }
    const position = error.position ? Number(error.position) : undefined;
    return new QueryError(error.message, 'QUERY_FAILED', position);
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  return new QueryError(message, 'CONNECTION_FAILED');
}

/** Drop trailing semicolons and whitespace so a single statement is sent as-is. */
export function normalizeSql(sql: string): string {
  return sql.replace(/[\s;]+$/u, '');
}

function readCursor(
  cursor: Cursor<unknown[]>,
  count: number,
): Promise<{ rows: unknown[][]; fields: pg.FieldDef[] }> {
  return new Promise((resolve, reject) => {
    cursor.read(count, (err, rows, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ rows, fields: result.fields });
    });
  });
}

/**
 * node-postgres parses `date` and `timestamp` (no time zone) in the server
 * process's local zone, which shifts values. Keep them as the database's text.
 * Scoped to these pools only; the global parsers are untouched.
 */
function createTypes(): pg.TypeOverrides {
  const types = new pg.TypeOverrides();
  types.setTypeParser(pg.types.builtins.DATE, (value) => value);
  types.setTypeParser(pg.types.builtins.TIMESTAMP, (value) => value);
  return types;
}

interface PrivilegeRow {
  superuser: boolean;
  exec_program: boolean | null;
  server_files: boolean | null;
  signal_backend: boolean | null;
}

/**
 * Read-only transactions don't stop everything (e.g. COPY … TO PROGRAM,
 * pg_terminate_backend, file access). Warn when the role can do those.
 */
export function privilegeWarnings(row: PrivilegeRow | undefined): string[] {
  if (!row) return [];
  if (row.superuser) {
    return [
      'This user is a superuser. Connect with a role that can only SELECT: read-only mode does not stop superusers from running programs or reading server files.',
    ];
  }
  const warnings: string[] = [];
  if (row.exec_program)
    warnings.push('This user can run server programs (pg_execute_server_program).');
  if (row.server_files)
    warnings.push('This user can read or write server files (pg_*_server_files).');
  if (row.signal_backend)
    warnings.push('This user can cancel or end other sessions (pg_signal_backend).');
  return warnings;
}

const PRIVILEGE_SQL = `
  select r.rolsuper as superuser,
         pg_has_role(current_user, 'pg_execute_server_program', 'member') as exec_program,
         pg_has_role(current_user, 'pg_read_server_files', 'member')
           or pg_has_role(current_user, 'pg_write_server_files', 'member') as server_files,
         pg_has_role(current_user, 'pg_signal_backend', 'member') as signal_backend
    from pg_roles r where r.rolname = current_user`;

export function connectPostgres(config: PostgresConfig): Connection {
  const connection = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: sslOption(config.ssl),
  };

  /** Cancel on a separate short-lived connection, so it works even when the pool is full. */
  async function cancelBackend(pid: number): Promise<void> {
    const client = new pg.Client({ ...connection, connectionTimeoutMillis: 5_000 });
    client.on('error', () => undefined);
    try {
      await client.connect();
      await client.query('select pg_cancel_backend($1)', [pid]);
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  const pool = new pg.Pool({
    ...connection,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: 'vantage',
    types: createTypes(),
    // Defense in depth: every session defaults to read-only with a hard timeout cap.
    options: `-c default_transaction_read_only=on -c statement_timeout=${QUERY_LIMITS.maxTimeoutMs}`,
  });
  // An idle client losing its connection must not crash the server.
  pool.on('error', () => undefined);

  async function acquire(): Promise<pg.PoolClient> {
    try {
      return await pool.connect();
    } catch (error) {
      throw new QueryError(
        `Could not connect: ${error instanceof Error ? error.message : 'unknown error'}`,
        'CONNECTION_FAILED',
      );
    }
  }

  /**
   * Run `fn` inside a read-only transaction with a server-side timeout, then
   * roll back and reset the session so nothing leaks into the next use.
   */
  async function readOnly<T>(
    timeoutMs: number,
    fn: (client: pg.PoolClient) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    if (signal?.aborted) throw new QueryError('Query cancelled', 'CANCELLED');
    const client = await acquire();
    let pid: number | undefined;
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
      if (pid === undefined) return;
      cancelBackend(pid).catch(() => undefined);
    };
    signal?.addEventListener('abort', cancel, { once: true });
    // Backstop in case the server ignores statement_timeout.
    const backstop = setTimeout(cancel, timeoutMs + 5_000);
    let healthy = true;
    try {
      await client.query('begin transaction read only');
      pid = (await client.query<{ pid: number }>('select pg_backend_pid() as pid')).rows[0]?.pid;
      if (signal?.aborted) throw new QueryError('Query cancelled', 'CANCELLED');
      // Both values are integers we control, never user text.
      await client.query(`set local statement_timeout = ${Math.trunc(timeoutMs)}`);
      await client.query(
        `set local idle_in_transaction_session_timeout = ${Math.trunc(timeoutMs)}`,
      );
      return await fn(client);
    } catch (error) {
      throw toQueryError(error, cancelled);
    } finally {
      clearTimeout(backstop);
      signal?.removeEventListener('abort', cancel);
      try {
        await client.query('rollback');
        // Undo anything the query changed for the session (SET, SET ROLE, prepared statements…).
        await client.query('discard all');
      } catch {
        healthy = false;
      }
      // A broken or tampered session is destroyed instead of returned to the pool.
      client.release(!healthy);
    }
  }

  return {
    async test() {
      const started = performance.now();
      try {
        const { version, warnings } = await readOnly(10_000, async (client) => {
          const res = await client.query<{ v: string }>('select version() as v');
          let privileges: PrivilegeRow | undefined;
          try {
            privileges = (await client.query<PrivilegeRow>(PRIVILEGE_SQL)).rows[0];
          } catch {
            // Older servers lack some predefined roles; skip the advice.
          }
          return { version: res.rows[0]?.v ?? '', warnings: privilegeWarnings(privileges) };
        });
        return {
          ok: true,
          serverVersion: version.split(' on ')[0] ?? version,
          latencyMs: Math.round(performance.now() - started),
          ...(warnings.length > 0 ? { warnings } : {}),
        };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : 'Connection failed',
          latencyMs: Math.round(performance.now() - started),
        };
      }
    },

    async introspect(): Promise<SchemaInfo> {
      const rows = await readOnly(INTROSPECTION_TIMEOUT_MS, async (client) => {
        const res = await client.query<{
          schema: string;
          name: string;
          kind: string;
          column: string;
          type: string;
          nullable: boolean;
        }>(
          `select n.nspname as schema, c.relname as name, c.relkind as kind,
                  a.attname as column, format_type(a.atttypid, a.atttypmod) as type,
                  not a.attnotnull as nullable
             from pg_class c
             join pg_namespace n on n.oid = c.relnamespace
             join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
            where c.relkind in ('r', 'p', 'v', 'm', 'f')
              and n.nspname not in ('pg_catalog', 'information_schema')
              and n.nspname not like 'pg\\_toast%'
              and n.nspname not like 'pg\\_temp%'
              and has_table_privilege(c.oid, 'SELECT')
            order by n.nspname, c.relname, a.attnum
            limit $1`,
          [MAX_INTROSPECTED_COLUMNS],
        );
        return res.rows;
      });

      const tables = new Map<string, TableInfo>();
      for (const row of rows) {
        const key = `${row.schema}.${row.name}`;
        let table = tables.get(key);
        if (!table) {
          table = {
            schema: row.schema,
            name: row.name,
            kind: row.kind === 'v' ? 'view' : row.kind === 'm' ? 'materialized_view' : 'table',
            columns: [],
          };
          tables.set(key, table);
        }
        table.columns.push({ name: row.column, nativeType: row.type, nullable: row.nullable });
      }
      return { tables: [...tables.values()] };
    },

    async execute(sql: string, options: ExecuteOptions): Promise<QueryResult> {
      const statement = normalizeSql(sql);
      if (!statement) throw new QueryError('Query is empty', 'QUERY_FAILED');
      const started = performance.now();

      return readOnly(
        options.timeoutMs,
        async (client) => {
          // Cursors use the extended protocol, which allows only one statement:
          // `select 1; drop table x` is rejected by the server.
          const cursor = client.query(new Cursor<unknown[]>(statement, [], { rowMode: 'array' }));
          try {
            const { rows, fields } = await readCursor(cursor, options.maxRows + 1);
            const columns = fields.map((f) => ({ name: f.name, ...describeOid(f.dataTypeID) }));
            const truncated = rows.length > options.maxRows;
            const kept = truncated ? rows.slice(0, options.maxRows) : rows;
            return {
              columns,
              rows: kept.map((row) => row.map((v, i) => toCell(v, columns[i]?.type ?? 'unknown'))),
              rowCount: kept.length,
              truncated,
              durationMs: Math.round(performance.now() - started),
            };
          } finally {
            await new Promise<void>((resolve) => {
              cursor.close(() => {
                resolve();
              });
            });
          }
        },
        options.signal,
      );
    },

    close: () => pool.end(),
  };
}
