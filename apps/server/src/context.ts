import { createDb, type Database } from '@vantage/db';
import { createAuth, type Auth } from './auth';
import type { Env } from './env';

/** Long-lived dependencies shared by every route. */
export interface AppContext {
  env: Env;
  db: Database;
  auth: Auth;
  close: () => Promise<void>;
}

export function createContext(env: Env): AppContext {
  const { db, close } = createDb(env.DATABASE_URL);
  const auth = createAuth({
    db,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.WEB_ORIGIN],
  });
  return { env, db, auth, close };
}
