import { postgresConfigSchema } from '@vantage/shared';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveQueryLimits } from '../limits';
import type { Connection } from '../types';
import { connectPostgres } from './connection';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('postgres connector (integration)', () => {
  let conn: Connection;
  let admin: pg.Client;

  beforeAll(async () => {
    const u = new URL(url ?? '');
    admin = new pg.Client({ connectionString: url });
    await admin.connect();
    await admin.query(`
      drop schema if exists connector_test cascade;
      create schema connector_test;
      create table connector_test.orders (id int primary key, amount numeric(10,2), placed_at timestamptz, placed_on date);
      insert into connector_test.orders
        select g, g * 1.5, timestamptz '2026-01-01 00:00:00+00' + g * interval '1 day', date '2026-01-01' + g
          from generate_series(1, 50) g;
      create view connector_test.big_orders as select * from connector_test.orders where amount > 50;
    `);
    conn = connectPostgres(
      postgresConfigSchema.parse({
        host: u.hostname,
        port: u.port || 5432,
        database: u.pathname.slice(1),
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
      }),
    );
  });

  afterAll(async () => {
    await conn.close();
    await admin.query('drop schema if exists connector_test cascade');
    await admin.end();
  });

  it('tests the connection', async () => {
    const result = await conn.test();
    expect(result.ok).toBe(true);
    expect(result.serverVersion).toMatch(/^PostgreSQL/);
    // The test user is a superuser (as in most local setups), which deserves a warning.
    expect(result.warnings?.[0]).toMatch(/superuser/);
  });

  it('runs a query and maps types', async () => {
    const result = await conn.execute(
      'select id, amount, placed_at, placed_on from connector_test.orders order by id limit 2;',
      resolveQueryLimits(),
    );
    expect(result.columns.map((c) => [c.name, c.type])).toEqual([
      ['id', 'integer'],
      ['amount', 'number'],
      ['placed_at', 'datetime'],
      ['placed_on', 'date'],
    ]);
    expect(result.rows[0]).toEqual([1, 1.5, '2026-01-02T00:00:00.000Z', '2026-01-02']);
    expect(result.truncated).toBe(false);
  });

  it('caps rows and reports truncation', async () => {
    const result = await conn.execute(
      'select * from connector_test.orders',
      resolveQueryLimits({ maxRows: 10 }),
    );
    expect(result.rowCount).toBe(10);
    expect(result.truncated).toBe(true);
  });

  it('refuses to write', async () => {
    await expect(
      conn.execute('delete from connector_test.orders', resolveQueryLimits()),
    ).rejects.toThrow(/read-only/);
    const { rows } = await admin.query<{ n: number }>(
      'select count(*)::int as n from connector_test.orders',
    );
    expect(rows[0]?.n).toBe(50);
  });

  it('rejects multiple statements', async () => {
    await expect(
      conn.execute('select 1; delete from connector_test.orders', resolveQueryLimits()),
    ).rejects.toMatchObject({ code: 'QUERY_FAILED' });
  });

  it('cannot escape the read-only transaction with SET', async () => {
    await expect(
      conn.execute('set default_transaction_read_only = off', resolveQueryLimits()),
    ).resolves.toBeDefined();
    await expect(
      conn.execute('delete from connector_test.orders', resolveQueryLimits()),
    ).rejects.toMatchObject({ code: 'QUERY_FAILED' });
  });

  it('times out on the server', async () => {
    await expect(
      conn.execute('select pg_sleep(5)', resolveQueryLimits({ timeoutMs: 200 })),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('can be cancelled', async () => {
    const controller = new AbortController();
    const running = conn.execute(
      'select pg_sleep(5)',
      resolveQueryLimits({ signal: controller.signal }),
    );
    setTimeout(() => {
      controller.abort();
    }, 200);
    await expect(running).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('reports syntax errors with a position', async () => {
    await expect(conn.execute('selec 1', resolveQueryLimits())).rejects.toMatchObject({
      code: 'QUERY_FAILED',
      position: 1,
    });
  });

  it('introspects tables and views', async () => {
    const { tables } = await conn.introspect();
    const orders = tables.find((t) => t.schema === 'connector_test' && t.name === 'orders');
    expect(orders?.kind).toBe('table');
    expect(orders?.columns.map((c) => c.name)).toEqual(['id', 'amount', 'placed_at', 'placed_on']);
    expect(orders?.columns[0]?.nullable).toBe(false);
    const view = tables.find((t) => t.name === 'big_orders');
    expect(view?.kind).toBe('view');
  });

  it('reports bad credentials without leaking the password', async () => {
    const bad = connectPostgres(
      postgresConfigSchema.parse({
        host: '127.0.0.1',
        port: 1,
        database: 'x',
        user: 'x',
        password: 'super-secret-pw',
      }),
    );
    const result = await bad.test();
    await bad.close();
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain('super-secret-pw');
  });
});
