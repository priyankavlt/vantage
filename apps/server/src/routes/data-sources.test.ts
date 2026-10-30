import { dataSource } from '@vantage/db/schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestApp,
  firstWorkspaceId,
  signUp,
  TEST_DATABASE_URL,
  testPostgresConfig,
  type TestApp,
} from '../test/helpers';

describe.skipIf(!TEST_DATABASE_URL)('data sources (integration)', () => {
  let t: TestApp;
  let cookie: string;
  let ws: string;
  let dsId: string;

  beforeAll(async () => {
    t = await createTestApp({ database: true });
    cookie = await signUp(t.app, { name: 'Owner', email: 'owner@example.com' });
    ws = await firstWorkspaceId(t.app, cookie);
  });
  afterAll(() => t.close());

  const url = (path = '') => `/api/workspaces/${ws}/data-sources${path}`;

  it('tests unsaved settings', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: url('/test'),
      headers: { cookie },
      payload: { type: 'postgres', config: testPostgresConfig(t) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
  });

  it('creates a data source and never returns the password', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: url(),
      headers: { cookie },
      payload: { name: 'Warehouse', type: 'postgres', config: testPostgresConfig(t) },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<Record<string, unknown>>();
    expect(body).toMatchObject({ name: 'Warehouse', type: 'postgres' });
    expect(JSON.stringify(body)).not.toMatch(/password/i);
    dsId = String(body.id);

    const list = await t.app.inject({ method: 'GET', url: url(), headers: { cookie } });
    expect(list.json()).toHaveLength(1);
    expect(list.body).not.toMatch(/password/i);
  });

  it('stores credentials encrypted', async () => {
    const [row] = await t.ctx.db.select().from(dataSource);
    expect(row?.encryptedConfig.startsWith('v1:')).toBe(true);
    expect(row?.encryptedConfig).not.toContain('"password"');
    expect(row?.encryptedConfig).not.toContain(testPostgresConfig(t).user);
  });

  it('rejects duplicate names', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: url(),
      headers: { cookie },
      payload: { name: 'Warehouse', type: 'postgres', config: testPostgresConfig(t) },
    });
    expect(res.statusCode).toBe(409);
  });

  it('refuses to save settings that cannot connect', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: url(),
      headers: { cookie },
      payload: {
        name: 'Broken',
        type: 'postgres',
        config: { ...testPostgresConfig(t), port: 1 },
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: 'CONNECTION_FAILED' } });
  });

  it('tests a saved data source and introspects its schema', async () => {
    const test = await t.app.inject({
      method: 'POST',
      url: url(`/${dsId}/test`),
      headers: { cookie },
    });
    expect(test.json()).toMatchObject({ ok: true });

    const schema = await t.app.inject({
      method: 'GET',
      url: url(`/${dsId}/schema`),
      headers: { cookie },
    });
    expect(schema.statusCode).toBe(200);
    const tables = schema.json<{ tables: { name: string }[] }>().tables.map((x) => x.name);
    // The test DB contains Vantage's own tables.
    expect(tables).toContain('data_source');
  });

  it('hides data sources from other workspaces', async () => {
    const other = await signUp(t.app, { name: 'Other', email: 'other@example.com' });
    const otherWs = await firstWorkspaceId(t.app, other);

    const res = await t.app.inject({ method: 'GET', url: url(), headers: { cookie: other } });
    expect(res.statusCode).toBe(403);

    // Even with their own workspace in the URL, the id from another workspace is not found.
    const cross = await t.app.inject({
      method: 'GET',
      url: `/api/workspaces/${otherWs}/data-sources/${dsId}/schema`,
      headers: { cookie: other },
    });
    expect(cross.statusCode).toBe(404);
  });

  it('deletes a data source', async () => {
    const res = await t.app.inject({ method: 'DELETE', url: url(`/${dsId}`), headers: { cookie } });
    expect(res.statusCode).toBe(204);
    const list = await t.app.inject({ method: 'GET', url: url(), headers: { cookie } });
    expect(list.json()).toHaveLength(0);
  });
});
