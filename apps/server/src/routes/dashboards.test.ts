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

describe.skipIf(!TEST_DATABASE_URL)('dashboards (integration)', () => {
  let t: TestApp;
  let cookie: string;
  let ws: string;
  let chartId: string;
  let otherChartId: string;

  beforeAll(async () => {
    t = await createTestApp({ database: true });
    const client = new pg.Client({ connectionString: t.ctx.env.DATABASE_URL });
    await client.connect();
    await client.query(
      `create table kpis (name text, value int); insert into kpis values ('users', 42);`,
    );
    await client.end();

    cookie = await signUp(t.app, { name: 'Dash', email: 'dash@example.com' });
    ws = await firstWorkspaceId(t.app, cookie);
    const post = async (path: string, payload: object) =>
      (
        await t.app.inject({
          method: 'POST',
          url: `/api/workspaces/${ws}${path}`,
          headers: { cookie },
          payload,
        })
      ).json<{
        id: string;
      }>();
    const ds = await post('/data-sources', {
      name: 'Local',
      type: 'postgres',
      config: testPostgresConfig(t),
    });
    const q = await post('/queries', {
      name: 'KPIs',
      sql: 'select * from kpis',
      dataSourceId: ds.id,
    });
    chartId = (
      await post('/charts', {
        name: 'Users',
        queryId: q.id,
        spec: { type: 'big-number', config: { value: 'value' } },
      })
    ).id;
    otherChartId = (
      await post('/charts', { name: 'Hidden', queryId: q.id, spec: { type: 'table', config: {} } })
    ).id;
  });
  afterAll(() => t.close());

  const url = (path = '') => `/api/workspaces/${ws}/dashboards${path}`;

  it('creates a dashboard, places charts, shares and revokes it', async () => {
    const created = await t.app.inject({
      method: 'POST',
      url: url(),
      headers: { cookie },
      payload: { name: 'Overview' },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json<{ id: string }>().id;

    const updated = await t.app.inject({
      method: 'PATCH',
      url: url(`/${id}`),
      headers: { cookie },
      payload: {
        refreshIntervalSeconds: 300,
        items: [{ i: 'a', chartId, x: 0, y: 0, w: 4, h: 3 }],
      },
    });
    expect(updated.json()).toMatchObject({
      refreshIntervalSeconds: 300,
      items: [{ chartId }],
      shareToken: null,
    });

    const shared = await t.app.inject({
      method: 'POST',
      url: url(`/${id}/share`),
      headers: { cookie },
    });
    const token = shared.json<{ shareToken: string }>().shareToken;
    expect(token.length).toBeGreaterThanOrEqual(32);

    // Anyone with the link, no cookie:
    const pub = await t.app.inject({ method: 'GET', url: `/api/public/dashboards/${token}` });
    expect(pub.statusCode).toBe(200);
    expect(pub.json()).toMatchObject({
      name: 'Overview',
      charts: [{ id: chartId, name: 'Users' }],
    });
    expect(pub.body).not.toContain(ws);

    const data = await t.app.inject({
      method: 'GET',
      url: `/api/public/dashboards/${token}/charts/${chartId}/data`,
    });
    expect(data.json()).toMatchObject({ rows: [['users', 42]] });

    // A chart that isn't on the dashboard can't be read through the link.
    const hidden = await t.app.inject({
      method: 'GET',
      url: `/api/public/dashboards/${token}/charts/${otherChartId}/data`,
    });
    expect(hidden.statusCode).toBe(404);

    const revoked = await t.app.inject({
      method: 'DELETE',
      url: url(`/${id}/share`),
      headers: { cookie },
    });
    expect(revoked.json()).toMatchObject({ shareToken: null });
    const gone = await t.app.inject({ method: 'GET', url: `/api/public/dashboards/${token}` });
    expect(gone.statusCode).toBe(404);
  });

  it('rejects charts from other workspaces and duplicate tile ids', async () => {
    const id = (
      await t.app.inject({
        method: 'POST',
        url: url(),
        headers: { cookie },
        payload: { name: 'Two' },
      })
    ).json<{ id: string }>().id;
    const unknown = await t.app.inject({
      method: 'PATCH',
      url: url(`/${id}`),
      headers: { cookie },
      payload: { items: [{ i: 'a', chartId: 'not-mine', x: 0, y: 0, w: 4, h: 3 }] },
    });
    expect(unknown.statusCode).toBe(400);
    const dup = await t.app.inject({
      method: 'PATCH',
      url: url(`/${id}`),
      headers: { cookie },
      payload: {
        items: [
          { i: 'a', chartId, x: 0, y: 0, w: 4, h: 3 },
          { i: 'a', chartId, x: 4, y: 0, w: 4, h: 3 },
        ],
      },
    });
    expect(dup.statusCode).toBe(400);
  });

  it('rejects unsupported refresh intervals and bad tokens', async () => {
    const id =
      (await t.app.inject({ method: 'GET', url: url(), headers: { cookie } })).json<
        { id: string }[]
      >()[0]?.id ?? '';
    const res = await t.app.inject({
      method: 'PATCH',
      url: url(`/${id}`),
      headers: { cookie },
      payload: { refreshIntervalSeconds: 1 },
    });
    expect(res.statusCode).toBe(400);
    const bad = await t.app.inject({
      method: 'GET',
      url: '/api/public/dashboards/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    expect(bad.statusCode).toBe(404);
  });
});
