import { once } from 'node:events';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Post } from '../../src/modules/posts/post.model.js';
import { api, auth, createPost, setupDb, teardownDb } from '../helpers.js';

const MISSING_ID = '64b7f0f0f0f0f0f0f0f0f0f0';

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(async () => {
  await Post.deleteMany({});
});

describe('POST /api/v1/cms/posts', () => {
  it('creates a draft authored by Brian Fox, ignoring a client-supplied author', async () => {
    const res = await api()
      .post('/api/v1/cms/posts')
      .set(auth)
      .send({ title: '  Hello ', body: 'World', hashtags: ['a'], author: 'Mallory' });

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/v1/cms/posts/${res.body.data.id}`);
    expect(res.body.data).toMatchObject({
      title: 'Hello',
      body: 'World',
      status: 'draft',
      author: 'Brian Fox',
      publishedAt: null,
    });
    expect(res.body.data._id).toBeUndefined();
    expect(res.body.data.__v).toBeUndefined();
    expect(res.body.data.createdAt).toBeDefined();
    expect(res.body.data.updatedAt).toBeDefined();
  });

  it('normalizes hashtags (trim, strip #, lowercase, dedupe)', async () => {
    const res = await api()
      .post('/api/v1/cms/posts')
      .set(auth)
      .send({
        title: 'T',
        body: 'B',
        hashtags: ['#NodeJS', ' nodejs ', 'Type_Script', '#typescript'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.hashtags).toEqual(['nodejs', 'type_script', 'typescript']);
  });

  it('sets publishedAt when created as published', async () => {
    const res = await api()
      .post('/api/v1/cms/posts')
      .set(auth)
      .send({ title: 'T', body: 'B', status: 'published' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.publishedAt).toEqual(expect.any(String));
  });

  it.each([
    ['missing title', { body: 'B' }],
    ['blank title', { title: '   ', body: 'B' }],
    ['title too long', { title: 'x'.repeat(201), body: 'B' }],
    ['missing body', { title: 'T' }],
    ['blank body', { title: 'T', body: '  ' }],
    ['invalid hashtag', { title: 'T', body: 'B', hashtags: ['bad tag'] }],
    [
      'too many hashtags',
      { title: 'T', body: 'B', hashtags: Array.from({ length: 21 }, (_, i) => `t${i}`) },
    ],
    ['hashtags not an array', { title: 'T', body: 'B', hashtags: 'a' }],
    ['invalid status', { title: 'T', body: 'B', status: 'archived' }],
  ])('rejects %s with 400 and zod details', async (_name, payload) => {
    const res = await api().post('/api/v1/cms/posts').set(auth).send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThan(0);
    expect(await Post.countDocuments()).toBe(0);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await api()
      .post('/api/v1/cms/posts')
      .set(auth)
      .set('Content-Type', 'application/json')
      .send('{"title": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects a request without a JSON body with 400', async () => {
    const res = await api().post('/api/v1/cms/posts').set(auth);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an oversized body with 413', async () => {
    const res = await api()
      .post('/api/v1/cms/posts')
      .set(auth)
      .send({ title: 'T', body: 'x'.repeat(200_000) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('authentication on CMS routes', () => {
  const routes = [
    ['get', '/api/v1/cms/posts'],
    ['post', '/api/v1/cms/posts'],
    ['get', `/api/v1/cms/posts/${MISSING_ID}`],
    ['patch', `/api/v1/cms/posts/${MISSING_ID}`],
    ['post', `/api/v1/cms/posts/${MISSING_ID}/publish`],
    ['post', `/api/v1/cms/posts/${MISSING_ID}/unpublish`],
    ['delete', `/api/v1/cms/posts/${MISSING_ID}`],
  ] as const;

  it.each(routes)('%s %s without a token returns 401', async (method, path) => {
    const res = await api()[method](path);
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toMatch(/^Bearer/);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it.each(['Bearer wrong', 'Basic test-token', 'test-token', 'Bearer '])(
    'rejects Authorization: %j',
    async (header) => {
      const res = await api().get('/api/v1/cms/posts').set('Authorization', header);
      expect(res.status).toBe(401);
    },
  );

  it('does not require a token for reader endpoints', async () => {
    expect((await api().get('/api/v1/posts')).status).toBe(200);
  });

  it('answers 401 before reading the body when the token is missing', async () => {
    const malformed = await api()
      .post('/api/v1/cms/posts')
      .set('Content-Type', 'application/json')
      .send('{"title": ');
    expect(malformed.status).toBe(401);

    // The body is declared (Content-Length) but never sent: a 401 proves the server does not
    // wait for it. Sending a real 200kb body would race the response against the socket reset.
    const server = createApp().listen(0);
    try {
      await once(server, 'listening');
      const { port } = server.address() as AddressInfo;
      const status = await new Promise<number>((resolve, reject) => {
        const req = http.request({
          port,
          method: 'POST',
          path: '/api/v1/cms/posts',
          headers: { 'Content-Type': 'application/json', 'Content-Length': '200000' },
        });
        req.setTimeout(5000, () => req.destroy(new Error('no response')));
        req.on('response', (res) => {
          res.resume();
          resolve(res.statusCode!);
          req.destroy();
        });
        req.on('error', reject);
        req.flushHeaders();
      });
      expect(status).toBe(401);
    } finally {
      server.close();
    }
  });
});

describe('GET /api/v1/posts (reader)', () => {
  it('lists only published posts, newest publishedAt first', async () => {
    const draft = await createPost({ title: 'draft' });
    const first = await createPost({ title: 'first' });
    const second = await createPost({ title: 'second' });
    await api().post(`/api/v1/cms/posts/${first.id}/publish`).set(auth);
    await api().post(`/api/v1/cms/posts/${second.id}/publish`).set(auth);

    const res = await api().get('/api/v1/posts');

    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { title: string }) => p.title)).toEqual(['second', 'first']);
    expect(res.body.data.map((p: { id: string }) => p.id)).not.toContain(draft.id);
  });

  it('filters by hashtag with match=any (default) and match=all, normalizing the filter', async () => {
    const a = await createPost({ title: 'a', hashtags: ['node', 'ts'], status: 'published' });
    const b = await createPost({ title: 'b', hashtags: ['node'], status: 'published' });
    await createPost({ title: 'c', hashtags: ['go'], status: 'published' });
    await createPost({ title: 'draft', hashtags: ['node', 'ts'] });

    const any = await api().get('/api/v1/posts').query({ hashtags: '#NODE,ts' });
    expect(any.body.data.map((p: { id: string }) => p.id).sort()).toEqual([a.id, b.id].sort());

    const all = await api().get('/api/v1/posts').query({ hashtags: 'node,ts', match: 'all' });
    expect(all.body.data.map((p: { id: string }) => p.id)).toEqual([a.id]);

    const none = await api().get('/api/v1/posts').query({ hashtags: 'unknown' });
    expect(none.body.data).toEqual([]);
    expect(none.body.meta.total).toBe(0);
  });

  it('paginates and reports meta', async () => {
    for (let i = 1; i <= 5; i++) await createPost({ title: `p${i}`, status: 'published' });

    const res = await api().get('/api/v1/posts').query({ page: 2, limit: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });

    const last = await api().get('/api/v1/posts').query({ page: 3, limit: 2 });
    expect(last.body.data).toHaveLength(1);
    const beyond = await api().get('/api/v1/posts').query({ page: 9, limit: 2 });
    expect(beyond.body.data).toEqual([]);
  });

  it('caps limit at 100 and rejects invalid pagination or filters', async () => {
    const capped = await api().get('/api/v1/posts').query({ limit: 1000 });
    expect(capped.body.meta.limit).toBe(100);

    for (const query of [
      { page: 0 },
      { limit: 0 },
      { limit: 'abc' },
      { match: 'some' },
      { hashtags: 'bad tag' },
    ]) {
      const res = await api().get('/api/v1/posts').query(query);
      expect(res.status, JSON.stringify(query)).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('GET /api/v1/posts/:id (reader)', () => {
  it('returns a published post', async () => {
    const post = await createPost({ status: 'published' });
    const res = await api().get(`/api/v1/posts/${post.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(post.id);
  });

  it('returns 404 for a draft, a missing post and a malformed id', async () => {
    const draft = await createPost();
    for (const id of [draft.id, MISSING_ID, 'not-an-id']) {
      const res = await api().get(`/api/v1/posts/${id}`);
      expect(res.status, id).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
  });
});

describe('CMS reads', () => {
  it('lists drafts and published posts and filters by status', async () => {
    await createPost({ title: 'd' });
    await createPost({ title: 'p', status: 'published' });

    const all = await api().get('/api/v1/cms/posts').set(auth);
    expect(all.body.meta.total).toBe(2);

    const drafts = await api().get('/api/v1/cms/posts').set(auth).query({ status: 'draft' });
    expect(drafts.body.data.map((p: { title: string }) => p.title)).toEqual(['d']);

    const bad = await api().get('/api/v1/cms/posts').set(auth).query({ status: 'nope' });
    expect(bad.status).toBe(400);
  });

  it('gets a draft by id, 404 when missing or malformed', async () => {
    const draft = await createPost();
    const found = await api().get(`/api/v1/cms/posts/${draft.id}`).set(auth);
    expect(found.body.data.id).toBe(draft.id);
    expect((await api().get(`/api/v1/cms/posts/${MISSING_ID}`).set(auth)).status).toBe(404);
    expect((await api().get('/api/v1/cms/posts/xyz').set(auth)).status).toBe(404);
  });
});

describe('PATCH /api/v1/cms/posts/:id', () => {
  it('updates provided fields only and normalizes hashtags', async () => {
    const post = await createPost({ title: 'Old', body: 'Keep', hashtags: ['x'] });

    const res = await api()
      .patch(`/api/v1/cms/posts/${post.id}`)
      .set(auth)
      .send({ title: 'New', hashtags: ['#Y'] });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ title: 'New', body: 'Keep', hashtags: ['y'] });
  });

  it.each([
    ['empty body', {}],
    ['status', { status: 'published' }],
    ['author', { author: 'Mallory' }],
    ['blank title', { title: ' ' }],
  ])('rejects %s with 400', async (_name, payload) => {
    const post = await createPost();
    const res = await api().patch(`/api/v1/cms/posts/${post.id}`).set(auth).send(payload);
    expect(res.status).toBe(400);
  });

  it('returns 404 for a missing post', async () => {
    const res = await api().patch(`/api/v1/cms/posts/${MISSING_ID}`).set(auth).send({ title: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('publish / unpublish', () => {
  it('publishes a draft and makes it visible to readers', async () => {
    const post = await createPost();

    const res = await api().post(`/api/v1/cms/posts/${post.id}/publish`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.publishedAt).toEqual(expect.any(String));
    expect((await api().get(`/api/v1/posts/${post.id}`)).status).toBe(200);
  });

  it('is idempotent: publishing again keeps publishedAt', async () => {
    const post = await createPost();
    const first = await api().post(`/api/v1/cms/posts/${post.id}/publish`).set(auth);
    const second = await api().post(`/api/v1/cms/posts/${post.id}/publish`).set(auth);

    expect(second.status).toBe(200);
    expect(second.body.data.publishedAt).toBe(first.body.data.publishedAt);
  });

  it('unpublishes back to a hidden draft with null publishedAt', async () => {
    const post = await createPost({ status: 'published' });

    const res = await api().post(`/api/v1/cms/posts/${post.id}/unpublish`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'draft', publishedAt: null });
    expect((await api().get(`/api/v1/posts/${post.id}`)).status).toBe(404);
  });

  it('returns 404 for missing or malformed ids', async () => {
    for (const action of ['publish', 'unpublish']) {
      const missing = await api().post(`/api/v1/cms/posts/${MISSING_ID}/${action}`).set(auth);
      const malformed = await api().post(`/api/v1/cms/posts/bad/${action}`).set(auth);
      expect(missing.status).toBe(404);
      expect(malformed.status).toBe(404);
    }
  });
});

describe('DELETE /api/v1/cms/posts/:id', () => {
  it('deletes with 204, then 404', async () => {
    const post = await createPost();

    const res = await api().delete(`/api/v1/cms/posts/${post.id}`).set(auth);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');

    expect((await api().delete(`/api/v1/cms/posts/${post.id}`).set(auth)).status).toBe(404);
    expect((await api().get(`/api/v1/cms/posts/${post.id}`).set(auth)).status).toBe(404);
  });

  it('returns 404 for a malformed id', async () => {
    expect((await api().delete('/api/v1/cms/posts/nope').set(auth)).status).toBe(404);
  });
});

describe('infrastructure', () => {
  it('GET /health reports the database state', async () => {
    const res = await api().get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'connected' });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await api().get('/api/v1/nothing');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('serves the OpenAPI document and Swagger UI', async () => {
    const spec = await api().get('/docs/openapi.json');
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toMatch(/^3\./);
    expect((await api().get('/docs/')).status).toBe(200);
  });

  it('does not leak internals on unexpected errors', async () => {
    await mongoose.connection.close();
    try {
      const res = await api().get('/health');
      expect(res.status).toBe(503);
      const failing = await api().get('/api/v1/posts/' + MISSING_ID);
      expect(failing.status).toBe(500);
      expect(failing.body.error).toEqual({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        requestId: failing.headers['x-request-id'],
      });
    } finally {
      await setupDb();
    }
  });
});
