import { describe, expect, it } from 'vitest';
import { DEFAULT_CMS_API_TOKEN, loadEnv } from '../../src/config/env.js';

describe('loadEnv', () => {
  it('applies defaults for an empty environment', () => {
    expect(loadEnv({})).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      CMS_API_TOKEN: DEFAULT_CMS_API_TOKEN,
    });
    expect(loadEnv({}).MONGODB_URI).toBeUndefined();
  });

  it('treats empty strings as unset (e.g. a .env with PORT= and NODE_ENV=)', () => {
    const env = loadEnv({ PORT: '', NODE_ENV: '', MONGODB_URI: '', CMS_API_TOKEN: '' });
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      CMS_API_TOKEN: DEFAULT_CMS_API_TOKEN,
    });
    expect(env.MONGODB_URI).toBeUndefined();
  });

  it.each([{ PORT: '0' }, { PORT: 'abc' }, { PORT: '70000' }, { NODE_ENV: 'staging' }])(
    'rejects invalid values %j',
    (source) => {
      expect(() => loadEnv(source)).toThrow(/Invalid environment configuration/);
    },
  );

  it('parses TRUST_PROXY as boolean, hop count or address list', () => {
    expect(loadEnv({}).TRUST_PROXY).toBe(false);
    expect(loadEnv({ TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(true);
    expect(loadEnv({ TRUST_PROXY: '1' }).TRUST_PROXY).toBe(1);
    expect(loadEnv({ TRUST_PROXY: 'loopback, 10.0.0.0/8' }).TRUST_PROXY).toBe(
      'loopback, 10.0.0.0/8',
    );
  });

  it('has rate limit and cache defaults, and rejects invalid limits', () => {
    expect(loadEnv({})).toMatchObject({
      RATE_LIMIT_WINDOW_MS: 60_000,
      RATE_LIMIT_PUBLIC_MAX: 120,
      RATE_LIMIT_CMS_MAX: 300,
      PUBLIC_CACHE_MAX_AGE: 0,
    });
    expect(() => loadEnv({ RATE_LIMIT_PUBLIC_MAX: '0' })).toThrow(/Invalid environment/);
  });
});
