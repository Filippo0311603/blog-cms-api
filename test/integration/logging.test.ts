import { Writable } from 'node:stream';
import { pino } from 'pino';
import mongoose from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { loggerOptions } from '../../src/utils/logger.js';
import { setupDb, teardownDb, TOKEN } from '../helpers.js';

describe('request logging', () => {
  it('never writes the bearer token to the logs', async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const logger = pino({ ...loggerOptions, level: 'info' }, stream);

    await request(createApp({ logger }))
      .get('/api/v1/cms/posts/not-an-id')
      .set('Authorization', `Bearer ${TOKEN}`)
      .set('Cookie', 'session=secret');

    const output = lines.join('');
    expect(output).toContain('"req"'); // the request was actually logged
    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain(TOKEN);
    expect(output).not.toContain('session=secret');
  });

  it('logs unexpected errors through the request logger, with the request id', async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const logger = pino({ ...loggerOptions, level: 'info' }, stream);
    const app = createApp({ logger });
    await setupDb();

    await mongoose.connection.close();
    let id: string;
    try {
      const res = await request(app).get('/api/v1/posts/' + '0'.repeat(24));
      expect(res.status).toBe(500);
      id = res.headers['x-request-id'] as string;
    } finally {
      await setupDb();
      await teardownDb();
    }

    const entry = lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((l) => l.msg === 'Unhandled error');
    expect(entry).toMatchObject({ req: { id } });
  });
});
