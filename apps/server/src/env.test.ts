import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

const key = Buffer.alloc(32, 7).toString('base64');
const secret = 'a-real-production-secret-0123456789abcdef';

describe('loadEnv', () => {
  it('requires both secrets in production', () => {
    expect(() => loadEnv({ NODE_ENV: 'production', BETTER_AUTH_SECRET: secret })).toThrow(
      /VANTAGE_ENCRYPTION_KEY/,
    );
    expect(() => loadEnv({ NODE_ENV: 'production', VANTAGE_ENCRYPTION_KEY: key })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
    expect(
      loadEnv({ NODE_ENV: 'production', BETTER_AUTH_SECRET: secret, VANTAGE_ENCRYPTION_KEY: key })
        .NODE_ENV,
    ).toBe('production');
  });

  it('rejects encryption keys that are not 32 bytes', () => {
    expect(() => loadEnv({ VANTAGE_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64') })).toThrow(
      /32 bytes/,
    );
  });

  it('allows missing secrets outside production', () => {
    expect(loadEnv({ NODE_ENV: 'development' }).BETTER_AUTH_SECRET).toBeTruthy();
  });
});

describe('loadEnv with empty values', () => {
  it('treats empty strings (from docker compose) as unset', () => {
    expect(() =>
      loadEnv({ NODE_ENV: 'production', BETTER_AUTH_SECRET: '', VANTAGE_ENCRYPTION_KEY: '' }),
    ).toThrow(/Required in production/);
  });
});
