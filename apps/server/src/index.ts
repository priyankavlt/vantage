import { runMigrations } from '@vantage/db';
import { buildApp } from './app';
import { createContext } from './context';
import { loadEnv } from './env';

const env = loadEnv();
const ctx = createContext(env);
await runMigrations(ctx.db, env.MIGRATIONS_DIR);
const app = await buildApp(ctx);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await ctx.close();
  process.exit(0);
};
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ host: env.SERVER_HOST, port: env.SERVER_PORT });
