import { describe, expect, it } from 'vitest';
import { initDatabase } from '../../src/db/index.js';

describe('initDatabase', () => {
  it('refuses to fall back to an in-memory MongoDB outside development', async () => {
    // test/setup.ts sets NODE_ENV=test and an empty MONGODB_URI.
    await expect(initDatabase()).rejects.toThrow(/MONGODB_URI is required/);
  });
});
