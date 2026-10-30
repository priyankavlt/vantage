// Config entry for `pnpm auth:generate` only (better-auth CLI). Not used at runtime.
import { createDb } from '@vantage/db';
import { createAuth } from './src/auth';

const { db } = createDb('postgres://localhost/unused');

export const auth = createAuth({
  db,
  secret: 'cli-only-secret-cli-only-secret',
  baseURL: 'http://localhost:3000',
  trustedOrigins: [],
});
