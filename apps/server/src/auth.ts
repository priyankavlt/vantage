import type { Database } from '@vantage/db';
import * as schema from '@vantage/db/schema';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins';

export interface AuthOptions {
  db: Database;
  secret: string;
  /** Public origin users see in the browser, e.g. http://localhost:3000. */
  baseURL: string;
  trustedOrigins: string[];
}

/** Turn a display name into a URL-safe slug with a random suffix, so slugs never collide. */
export function workspaceSlug(name: string): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'workspace';
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

/**
 * better-auth instance. Workspaces are better-auth "organizations";
 * memberships are its "members" (roles: owner, admin, member).
 */
export function createAuth(options: AuthOptions) {
  const auth = betterAuth({
    appName: 'Vantage',
    secret: options.secret,
    baseURL: options.baseURL,
    basePath: '/api/auth',
    trustedOrigins: options.trustedOrigins,
    database: drizzleAdapter(options.db, { provider: 'pg', schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    plugins: [organization({ creatorRole: 'owner' })],
    databaseHooks: {
      user: {
        create: {
          // Every new user starts with a personal workspace.
          after: async (user) => {
            const firstName = user.name.trim().split(/\s+/)[0] ?? 'My';
            await auth.api.createOrganization({
              body: {
                name: `${firstName}'s workspace`,
                slug: workspaceSlug(firstName),
                userId: user.id,
              },
            });
          },
        },
      },
    },
  });
  return auth;
}

export type Auth = ReturnType<typeof createAuth>;
