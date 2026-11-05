import type { RequestHandler } from 'express';

/**
 * Public reads: with `maxAgeSeconds` > 0 caches may reuse the response for that long; with 0 they
 * must revalidate every time (`no-cache`), which the ETag turns into a cheap 304.
 */
export const publicCache = (maxAgeSeconds: number): RequestHandler => {
  const value = maxAgeSeconds > 0 ? `public, max-age=${maxAgeSeconds}` : 'public, no-cache';
  return (_req, res, next) => {
    res.set('Cache-Control', value);
    next();
  };
};

/** CMS responses (drafts, authenticated data) must never be stored by any cache. */
export const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};
