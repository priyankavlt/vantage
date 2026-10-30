import { runMigrations } from '@vantage/db';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
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

export async function createTestApp(
  options: { database?: boolean; env?: NodeJS.ProcessEnv } = {},
): Promise<TestApp> {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL ?? 'postgres://unused@localhost:1/unused',
    ...options.env,
  });
  const ctx = createContext(env);
  if (options.database) {
    // Start every suite from an empty schema.
    await ctx.db.execute(sql`drop schema if exists public cascade`);
    await ctx.db.execute(sql`drop schema if exists drizzle cascade`);
    await ctx.db.execute(sql`create schema public`);
    await runMigrations(ctx.db, env.MIGRATIONS_DIR);
  }
  const app = await buildApp(ctx);
  return {
    app,
    ctx,
    close: async () => {
      await app.close();
      await ctx.close();
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
