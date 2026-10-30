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

describe.skipIf(!TEST_DATABASE_URL)('charts (integration)', () => {
  let t: TestApp;
  let cookie: string;
  let ws: string;
  let queryId: string;

  beforeAll(async () => {
    t = await createTestApp({ database: true });
    const client = new pg.Client({ connectionString: t.ctx.env.DATABASE_URL });
    await client.connect();
    await client.query(
      `create table visits (day date, n int); insert into visits values ('2026-01-01', 3), ('2026-01-02', 5);`,
    );
    await client.end();

    cookie = await signUp(t.app, { name: 'Charter', email: 'charter@example.com' });
    ws = await firstWorkspaceId(t.app, cookie);
    const ds = await t.app.inject({
      method: 'POST',
      url: `/api/workspaces/${ws}/data-sources`,
      headers: { cookie },
      payload: { name: 'Local', type: 'postgres', config: testPostgresConfig(t) },
    });
    const q = await t.app.inject({
      method: 'POST',
      url: `/api/workspaces/${ws}/queries`,
      headers: { cookie },
      payload: {
        name: 'Visits',
        sql: 'select day, n from visits order by day',
        dataSourceId: ds.json<{ id: string }>().id,
      },
    });
    queryId = q.json<{ id: string }>().id;
  });
  afterAll(() => t.close());

  const base = () => `/api/workspaces/${ws}/charts`;

  it('creates a chart, returns its data, updates and deletes it', async () => {
    const created = await t.app.inject({
      method: 'POST',
      url: base(),
      headers: { cookie },
      payload: {
        name: 'Visits per day',
        queryId,
        spec: { type: 'line', config: { x: 'day', y: ['n'] } },
      },
    });
    expect(created.statusCode).toBe(201);
    const chart = created.json<{ id: string; spec: unknown }>();
    expect(chart.spec).toEqual({ type: 'line', config: { x: 'day', y: ['n'], stacked: false } });

    const data = await t.app.inject({
      method: 'GET',
      url: `${base()}/${chart.id}/data`,
      headers: { cookie },
    });
    expect(data.json()).toMatchObject({
      rows: [
        ['2026-01-01', 3],
        ['2026-01-02', 5],
      ],
    });

    const updated = await t.app.inject({
      method: 'PATCH',
      url: `${base()}/${chart.id}`,
      headers: { cookie },
      payload: { spec: { type: 'big-number', config: { value: 'n' } } },
    });
    expect(updated.json()).toMatchObject({ spec: { type: 'big-number' } });

    const list = await t.app.inject({ method: 'GET', url: base(), headers: { cookie } });
    expect(list.json()).toHaveLength(1);

    const del = await t.app.inject({
      method: 'DELETE',
      url: `${base()}/${chart.id}`,
      headers: { cookie },
    });
    expect(del.statusCode).toBe(204);
  });

  it('rejects invalid specs', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: base(),
      headers: { cookie },
      payload: { name: 'Bad', queryId, spec: { type: 'bar', config: { x: 'day', y: [] } } },
    });
    expect(res.statusCode).toBe(400);
  });

  it("can't chart another workspace's query", async () => {
    const other = await signUp(t.app, { name: 'Other', email: 'other3@example.com' });
    const otherWs = await firstWorkspaceId(t.app, other);
    const res = await t.app.inject({
      method: 'POST',
      url: `/api/workspaces/${otherWs}/charts`,
      headers: { cookie: other },
      payload: { name: 'Steal', queryId, spec: { type: 'table', config: {} } },
    });
    expect(res.statusCode).toBe(404);
  });
});
