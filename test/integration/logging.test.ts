import { Writable } from 'node:stream';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { loggerOptions } from '../../src/utils/logger.js';
import { TOKEN } from '../helpers.js';

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
});
