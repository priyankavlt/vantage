import { createDefaultRegistry } from '@vantage/connectors';
import { createDb, type Database } from '@vantage/db';
import { createAuth, type Auth } from './auth';
import { ConnectionManager } from './connections';
import { SecretBox } from './crypto';
import type { Env } from './env';
import { ConcurrencyLimiter } from './limiter';
import { MAX_CONCURRENT_QUERIES_PER_WORKSPACE } from './run-query';

/** Long-lived dependencies shared by every route. */
export interface AppContext {
  env: Env;
  db: Database;
  auth: Auth;
  secrets: SecretBox;
  connections: ConnectionManager;
  /** Caps concurrent queries per workspace. */
  queryLimiter: ConcurrencyLimiter;
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
  // Production requires a real key (enforced in env.ts); dev derives one from the auth secret.
  const secrets = env.VANTAGE_ENCRYPTION_KEY
    ? SecretBox.fromBase64(env.VANTAGE_ENCRYPTION_KEY)
    : SecretBox.fromPassphrase(env.BETTER_AUTH_SECRET);
  const connections = new ConnectionManager(createDefaultRegistry(), secrets);
  return {
    env,
    db,
    auth,
    secrets,
    connections,
    queryLimiter: new ConcurrencyLimiter(MAX_CONCURRENT_QUERIES_PER_WORKSPACE),
    close: async () => {
      await connections.closeAll();
      await close();
    },
  };
}
