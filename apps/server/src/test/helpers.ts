import { runMigrations } from '@vantage/db';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from '../app';
import { createContext, type AppContext } from '../context';
import { loadEnv } from '../env';

/** Set TEST_DATABASE_URL to run integration tests against a real (disposable) Postgres. */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export interface TestApp {
  app: FastifyInstance;
  ctx: AppContext;
  close: () => Promise<void>;
}

async function createDatabase(): Promise<{ url: string; drop: () => Promise<void> }> {
  const name = `vantage_test_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const admin = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();
  const url = new URL(TEST_DATABASE_URL ?? '');
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    drop: async () => {
      const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
      await client.connect();
      await client.query(`drop database if exists ${name} with (force)`);
      await client.end();
    },
  };
}

export async function createTestApp(
  options: { database?: boolean; env?: NodeJS.ProcessEnv } = {},
): Promise<TestApp> {
  // Each suite gets its own fresh database, so test files can run in parallel.
  const database = options.database && TEST_DATABASE_URL ? await createDatabase() : null;
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: database?.url ?? 'postgres://unused@localhost:1/unused',
    ...options.env,
  });
  const ctx = createContext(env);
  if (database) await runMigrations(ctx.db, env.MIGRATIONS_DIR);
  const app = await buildApp(ctx);
  return {
    app,
    ctx,
    close: async () => {
      await app.close();
      await ctx.close();
      await database?.drop();
    },
  };
}

/** Sign up through the real better-auth endpoint and return the session cookie. */
export async function signUp(
  app: FastifyInstance,
  user: { name: string; email: string; password?: string },
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers: { origin: 'http://localhost:3000' },
    payload: { password: 'correct-horse-battery', ...user },
  });
  if (res.statusCode !== 200) throw new Error(`sign-up failed: ${res.statusCode} ${res.body}`);
  const cookies = res.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  if (!cookies) throw new Error('sign-up returned no session cookie');
  return cookies;
}

export async function listWorkspaces(
  app: FastifyInstance,
  cookie: string,
): Promise<{ id: string; name: string }[]> {
  const res = await app.inject({
    method: 'GET',
    url: '/api/auth/organization/list',
    headers: { cookie },
  });
  return res.json();
}

/** Connection settings pointing at the suite's own database, used as a "customer" database. */
export function testPostgresConfig(t: TestApp) {
  const u = new URL(t.ctx.env.DATABASE_URL);
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    database: u.pathname.slice(1),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl: 'disable' as const,
  };
}

export async function firstWorkspaceId(app: FastifyInstance, cookie: string): Promise<string> {
  const [ws] = await listWorkspaces(app, cookie);
  if (!ws) throw new Error('user has no workspace');
  return ws.id;
}
