import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';

/**
 * Express would add an ETag to every response; the app disables that (`etag: false`) so that
 * no-store responses never carry one. Public reads opt in here: a weak ETag over the body.
 * Express then answers a matching `If-None-Match` with 304 on its own.
 */
const withWeakEtag: RequestHandler = (_req, res, next) => {
  const send = res.send.bind(res);
  res.send = (body?: unknown) => {
    if (
      res.statusCode < 300 &&
      !res.get('ETag') &&
      (typeof body === 'string' || Buffer.isBuffer(body))
    ) {
      const hash = createHash('sha1').update(body).digest('base64').slice(0, 27);
      res.set('ETag', `W/"${Buffer.byteLength(body).toString(16)}-${hash}"`);
    }
    return send(body);
  };
  next();
};

/**
 * Public reads: with `maxAgeSeconds` > 0 caches may reuse the response for that long; with 0 they
 * must revalidate every time (`no-cache`), which the ETag turns into a cheap 304.
 */
export const publicCache = (maxAgeSeconds: number): RequestHandler => {
  const value = maxAgeSeconds > 0 ? `public, max-age=${maxAgeSeconds}` : 'public, no-cache';
  return (req, res, next) => {
    res.set('Cache-Control', value);
    withWeakEtag(req, res, next);
  };
};

/** CMS responses (drafts, authenticated data) must never be stored by any cache. */
export const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};
