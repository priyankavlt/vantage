import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestApp,
  firstWorkspaceId,
  signUp,
  TEST_DATABASE_URL,
  testPostgresConfig,
  type TestApp,
} from '../test/helpers';

describe.skipIf(!TEST_DATABASE_URL)('queries (integration)', () => {
  let t: TestApp;
  let cookie: string;
  let ws: string;
  let dsId: string;

  beforeAll(async () => {
    t = await createTestApp({ database: true });
    // Some "customer" data in the suite database.
    const client = new pg.Client({ connectionString: t.ctx.env.DATABASE_URL });
    await client.connect();
    await client.query(`
      create table sales (region text, amount int);
      insert into sales values ('north', 10), ('south', 20), ('north', 5);
    `);
    await client.end();

    cookie = await signUp(t.app, { name: 'Analyst', email: 'analyst@example.com' });
    ws = await firstWorkspaceId(t.app, cookie);
    const res = await t.app.inject({
      method: 'POST',
      url: `/api/workspaces/${ws}/data-sources`,
      headers: { cookie },
      payload: { name: 'Local', type: 'postgres', config: testPostgresConfig(t) },
    });
    dsId = res.json<{ id: string }>().id;
  });
  afterAll(() => t.close());

  const run = (sql: string, extra: Record<string, unknown> = {}) =>
    t.app.inject({
      method: 'POST',
      url: `/api/workspaces/${ws}/queries/run`,
      headers: { cookie },
      payload: { dataSourceId: dsId, sql, ...extra },
    });

  it('runs a query', async () => {
    const res = await run(
      'select region, sum(amount)::int as total from sales group by 1 order by 1',
    );
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      columns: [{ name: 'region' }, { name: 'total', type: 'integer' }],
      rows: [
        ['north', 15],
        ['south', 20],
      ],
      rowCount: 2,
      truncated: false,
    });
  });

  it('applies the requested row cap', async () => {
    const res = await run('select * from sales', { maxRows: 1 });
    expect(res.json()).toMatchObject({ rowCount: 1, truncated: true });
  });

  it('returns database errors with the position', async () => {
    const res = await run('select nope from sales');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { code: 'QUERY_FAILED', details: { position: 8 } },
    });
  });

  it('refuses writes', async () => {
    const res = await run('drop table sales');
    expect(res.statusCode).toBe(400);
    const check = await run('select count(*)::int as n from sales');
    expect(check.json<{ rows: number[][] }>().rows[0]?.[0]).toBe(3);
  });

  it('times out', async () => {
    const res = await run('select pg_sleep(3)', { timeoutMs: 100 });
    expect(res.statusCode).toBe(408);
    expect(res.json()).toMatchObject({ error: { code: 'TIMEOUT' } });
  });

  it('saves, lists, updates and deletes queries', async () => {
    const base = `/api/workspaces/${ws}/queries`;
    const created = await t.app.inject({
      method: 'POST',
      url: base,
      headers: { cookie },
      payload: { name: 'Sales by region', sql: 'select 1', dataSourceId: dsId },
    });
    expect(created.statusCode).toBe(201);
    const { id } = created.json<{ id: string }>();

    const updated = await t.app.inject({
      method: 'PATCH',
      url: `${base}/${id}`,
      headers: { cookie },
      payload: { sql: 'select 2' },
    });
    expect(updated.json()).toMatchObject({ name: 'Sales by region', sql: 'select 2' });

    const list = await t.app.inject({ method: 'GET', url: base, headers: { cookie } });
    expect(list.json()).toHaveLength(1);

    const del = await t.app.inject({ method: 'DELETE', url: `${base}/${id}`, headers: { cookie } });
    expect(del.statusCode).toBe(204);
    const gone = await t.app.inject({ method: 'GET', url: `${base}/${id}`, headers: { cookie } });
    expect(gone.statusCode).toBe(404);
  });

  it("can't run or save against another workspace's data source", async () => {
    const other = await signUp(t.app, { name: 'Other', email: 'other2@example.com' });
    const otherWs = await firstWorkspaceId(t.app, other);
    const runRes = await t.app.inject({
      method: 'POST',
      url: `/api/workspaces/${otherWs}/queries/run`,
      headers: { cookie: other },
      payload: { dataSourceId: dsId, sql: 'select 1' },
    });
    expect(runRes.statusCode).toBe(404);
    const saveRes = await t.app.inject({
      method: 'POST',
      url: `/api/workspaces/${otherWs}/queries`,
      headers: { cookie: other },
      payload: { name: 'x', sql: 'select 1', dataSourceId: dsId },
    });
    expect(saveRes.statusCode).toBe(404);
  });
});
