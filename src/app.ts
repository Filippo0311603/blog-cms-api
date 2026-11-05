import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { isDbConnected } from './db/index.js';
import { createDocsHandlers } from './docs/swagger.js';
import { requireBearerToken } from './middlewares/auth.js';
import { noStore, publicCache } from './middlewares/cacheControl.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { createRateLimiter } from './middlewares/rateLimit.js';
import type { RateLimitOptions } from './middlewares/rateLimit.js';
import { genReqId, requestId } from './middlewares/requestId.js';
import { cmsPostsRouter, publicPostsRouter } from './modules/posts/post.routes.js';
import { logger as defaultLogger } from './utils/logger.js';
import type { Logger } from 'pino';

export interface AppOptions {
  logger?: Logger;
  /** Per-route-group rate limits; defaults come from the environment. */
  rateLimits?: { public: RateLimitOptions; cms: RateLimitOptions };
  /** `max-age` of public GETs in seconds; defaults to PUBLIC_CACHE_MAX_AGE. */
  publicCacheMaxAge?: number;
}

const defaultRateLimits = () => ({
  public: { windowMs: env.RATE_LIMIT_WINDOW_MS, max: env.RATE_LIMIT_PUBLIC_MAX },
  cms: { windowMs: env.RATE_LIMIT_WINDOW_MS, max: env.RATE_LIMIT_CMS_MAX },
});

/** Builds the Express app without listening, so tests can drive it with Supertest. */
export function createApp({
  logger = defaultLogger,
  rateLimits = defaultRateLimits(),
  publicCacheMaxAge = env.PUBLIC_CACHE_MAX_AGE,
}: AppOptions = {}) {
  const app = express();
  // Needed behind a reverse proxy so req.ip (rate limiting, logs) is the real client address.
  app.set('trust proxy', env.TRUST_PROXY);
  // Applies to every route, including /docs (helmet is mounted after the docs).
  app.disable('x-powered-by');
  // ETags are added explicitly to public reads (publicCache); responses that are no-store carry none.
  app.set('etag', false);

  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId }));

  // Swagger UI needs inline scripts that helmet's default CSP blocks, so docs are mounted first.
  app.use('/docs', ...createDocsHandlers());

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    }),
  );

  app.get('/health', (_req, res) => {
    const db = isDbConnected();
    res.status(db ? 200 : 503).json({
      status: db ? 'ok' : 'degraded',
      db: db ? 'connected' : 'disconnected',
      uptime: Math.round(process.uptime()),
    });
  });

  const v1 = express.Router();
  v1.use(
    '/posts',
    createRateLimiter(rateLimits.public),
    publicCache(publicCacheMaxAge),
    publicPostsRouter,
  );
  // The limiter runs before the auth check so that token guessing is throttled too.
  v1.use(
    '/cms/posts',
    noStore,
    createRateLimiter(rateLimits.cms),
    requireBearerToken(env.CMS_API_TOKEN),
    cmsPostsRouter,
  );
  app.use('/api/v1', v1);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
