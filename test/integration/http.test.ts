import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { api, auth, createPost, setupDb, teardownDb } from '../helpers.js';

beforeAll(setupDb);
afterAll(teardownDb);

describe('request id', () => {
  it('generates an id and echoes it in the response header', async () => {
    const res = await api().get('/api/v1/posts');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reuses a well-formed incoming id', async () => {
    const res = await api().get('/health').set('X-Request-Id', 'client-id.123');
    expect(res.headers['x-request-id']).toBe('client-id.123');
  });

  it('replaces a malformed incoming id', async () => {
    const res = await api().get('/health').set('X-Request-Id', 'bad id with spaces');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('includes the id in error responses', async () => {
    const res = await api().get('/nope').set('X-Request-Id', 'abc-1');
    expect(res.status).toBe(404);
    expect(res.body.error.requestId).toBe('abc-1');
    expect(res.headers['x-request-id']).toBe('abc-1');
  });
});

describe('HTTP caching', () => {
  it('sets Cache-Control on public reads and returns 304 for a matching If-None-Match', async () => {
    const post = await createPost({ title: 'Cached', status: 'published' });

    for (const url of ['/api/v1/posts', `/api/v1/posts/${post.id}`]) {
      const first = await api().get(url);
      expect(first.status).toBe(200);
      expect(first.headers['cache-control']).toBe('public, no-cache');
      expect(first.headers.etag).toBeDefined();

      const second = await api().get(url).set('If-None-Match', first.headers.etag!);
      expect(second.status).toBe(304);
      expect(second.text).toBe('');
    }
  });

  it('uses max-age when a cache lifetime is configured', async () => {
    const res = await request(createApp({ publicCacheMaxAge: 45 })).get('/api/v1/posts');
    expect(res.headers['cache-control']).toBe('public, max-age=45');
  });

  it('does not cache public errors', async () => {
    const res = await api().get('/api/v1/posts/not-an-id');
    expect(res.status).toBe(404);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('marks CMS responses, including 401, as no-store', async () => {
    const ok = await api().get('/api/v1/cms/posts').set(auth);
    expect(ok.headers['cache-control']).toBe('no-store');
    const denied = await api().get('/api/v1/cms/posts');
    expect(denied.status).toBe(401);
    expect(denied.headers['cache-control']).toBe('no-store');
  });
});

describe('rate limiting', () => {
  const windowMs = 60_000;

  it('returns 429 with the standard error shape and RateLimit headers once the limit is hit', async () => {
    const agent = request(
      createApp({ rateLimits: { public: { windowMs, max: 2 }, cms: { windowMs, max: 100 } } }),
    );

    const first = await agent.get('/api/v1/posts');
    expect(first.status).toBe(200);
    expect(first.headers['ratelimit-limit']).toBe('2');
    expect(first.headers['ratelimit-remaining']).toBe('1');
    await agent.get('/api/v1/posts');

    const limited = await agent.get('/api/v1/posts');
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
    expect(limited.headers['ratelimit-remaining']).toBe('0');
    expect(limited.body.error).toMatchObject({ code: 'TOO_MANY_REQUESTS' });
    expect(limited.body.error.requestId).toBe(limited.headers['x-request-id']);
  });

  it('counts public and CMS routes separately and leaves /health unlimited', async () => {
    const agent = request(
      createApp({ rateLimits: { public: { windowMs, max: 1 }, cms: { windowMs, max: 1 } } }),
    );
    await agent.get('/api/v1/posts');
    expect((await agent.get('/api/v1/posts')).status).toBe(429);
    expect((await agent.get('/api/v1/cms/posts').set(auth)).status).toBe(200);
    expect((await agent.get('/api/v1/cms/posts').set(auth)).status).toBe(429);
    expect((await agent.get('/health')).status).toBe(200);
  });
});
