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
});
