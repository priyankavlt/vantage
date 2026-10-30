import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const DEV_SECRET = 'vantage-dev-secret-do-not-use-in-production';

const optionalSecret = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    SERVER_HOST: z.string().default('0.0.0.0'),
    SERVER_PORT: z.coerce.number().int().positive().default(4000),
    WEB_ORIGIN: z.url().default('http://localhost:3000'),
    DATABASE_URL: z.url().default('postgres://vantage:vantage@localhost:5432/vantage'),
    BETTER_AUTH_SECRET: optionalSecret(z.string().min(32)),
    BETTER_AUTH_URL: z.url().optional(),
    MIGRATIONS_DIR: z.string().optional(),
    /** base64-encoded 32-byte key for encrypting data source credentials. */
    VANTAGE_ENCRYPTION_KEY: optionalSecret(
      z
        .string()
        .refine((v) => Buffer.from(v, 'base64').length === 32, 'Must be 32 bytes, base64-encoded'),
    ),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .transform((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      // Two separate secrets: rotating the auth secret must never make saved credentials unreadable.
      let ok = true;
      for (const key of ['BETTER_AUTH_SECRET', 'VANTAGE_ENCRYPTION_KEY'] as const) {
        if (!env[key]) {
          ctx.addIssue({ code: 'custom', path: [key], message: 'Required in production' });
          ok = false;
        }
      }
      if (env.BETTER_AUTH_SECRET === DEV_SECRET) {
        ctx.addIssue({
          code: 'custom',
          path: ['BETTER_AUTH_SECRET'],
          message: 'The development secret cannot be used in production',
        });
        ok = false;
      }
      if (!ok) return z.NEVER;
    }
    return {
      ...env,
      BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET ?? DEV_SECRET,
      BETTER_AUTH_URL: env.BETTER_AUTH_URL ?? env.WEB_ORIGIN,
      // src/ and dist/ both sit one level below apps/server.
      MIGRATIONS_DIR:
        env.MIGRATIONS_DIR ??
        fileURLToPath(new URL('../../../packages/db/drizzle', import.meta.url)),
    };
  });

export type Env = z.infer<typeof envSchema>;

/** Parse and validate environment variables once, at startup. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
