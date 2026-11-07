import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Post } from '../../src/modules/posts/post.model.js';
import { api, auth, createPost, setupDb, teardownDb } from '../helpers.js';

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(async () => {
  await Post.deleteMany({});
});

describe('framework-level client errors', () => {
  it('does not return 500 for malformed percent-encoding in the path (404)', async () => {
    const reader = await api().get('/api/v1/posts/%E0%A4%A');
    expect(reader.status).toBe(404);
    expect(reader.body.error.code).toBe('NOT_FOUND');
    const cms = await api().get('/api/v1/cms/posts/%zz').set(auth);
    expect(cms.status).toBe(404);
  });

  it('answers a corrupt gzip body with a 4xx, not 500', async () => {
    const res = await api()
      .post('/api/v1/cms/posts')
      .set(auth)
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip')
      .send('{"title":"T","body":"B"}');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.body.error.code).toBeDefined();
  });

  it('answers an unknown Content-Encoding with 415', async () => {
    const res = await api()
      .post('/api/v1/cms/posts')
      .set(auth)
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'bogus')
      .send('{"title":"T","body":"B"}');
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects a non-JSON Content-Type on POST and PATCH with 415', async () => {
    const created = await api()
      .post('/api/v1/cms/posts')
      .set(auth)
      .set('Content-Type', 'text/plain')
      .send('title=x');
    expect(created.status).toBe(415);
    expect(created.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');

    const post = await createPost();
    const patched = await api()
      .patch(`/api/v1/cms/posts/${post.id}`)
      .set(auth)
      .set('Content-Type', 'text/plain')
      .send('title=x');
    expect(patched.status).toBe(415);
  });
});

describe('other behaviours', () => {
  it('unpublish is idempotent and leaves a draft untouched', async () => {
    const post = await createPost();
    const res = await api().post(`/api/v1/cms/posts/${post.id}/unpublish`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.updatedAt).toBe(post.updatedAt);
  });

  it('accepts a repeated hashtags query parameter (and an encoded #)', async () => {
    const a = await createPost({ hashtags: ['x'], status: 'published' });
    const b = await createPost({ hashtags: ['y'], status: 'published' });
    await createPost({ hashtags: ['z'], status: 'published' });

    const res = await api().get('/api/v1/posts?hashtags=x&hashtags=%23Y');

    expect(res.body.data.map((p: { id: string }) => p.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('filters the CMS list by hashtag (any/all) including drafts', async () => {
    const draft = await createPost({ hashtags: ['a', 'b'] });
    await createPost({ hashtags: ['a'], status: 'published' });

    const any = await api().get('/api/v1/cms/posts').set(auth).query({ hashtags: 'a' });
    expect(any.body.meta.total).toBe(2);

    const all = await api()
      .get('/api/v1/cms/posts')
      .set(auth)
      .query({ hashtags: 'a,b', match: 'all' });
    expect(all.body.data.map((p: { id: string }) => p.id)).toEqual([draft.id]);
  });

  it('does not send the X-Powered-By header', async () => {
    const res = await api().get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
