import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { VERSION } from './app';
import { createTestApp, type TestApp } from './test/helpers';

describe('server basics', () => {
  let t: TestApp;
  let app: FastifyInstance;

  beforeAll(async () => {
    t = await createTestApp();
    app = t.app;
  });
  afterAll(() => t.close());

  it('GET /api/health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', version: VERSION });
  });

  it('unknown routes return 404 in the ApiError shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('blocks state-changing requests from other origins', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/workspaces/ws_1/dashboards',
      headers: { origin: 'https://evil.example' },
      payload: { name: 'x' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: { code: 'BAD_ORIGIN' } });
  });

  it('workspace routes require a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/workspaces/ws_1' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });
});
