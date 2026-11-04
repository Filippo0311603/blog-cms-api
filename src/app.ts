import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { isDbConnected } from './db/index.js';
import { createDocsHandlers } from './docs/swagger.js';
import { requireBearerToken } from './middlewares/auth.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { cmsPostsRouter, publicPostsRouter } from './modules/posts/post.routes.js';
import { logger as defaultLogger } from './utils/logger.js';
import type { Logger } from 'pino';

/** Builds the Express app without listening, so tests can drive it with Supertest. */
export function createApp({ logger = defaultLogger }: { logger?: Logger } = {}) {
  const app = express();
  // Applies to every route, including /docs (helmet is mounted after the docs).
  app.disable('x-powered-by');

  app.use(pinoHttp({ logger }));

  // Swagger UI needs inline scripts that helmet's default CSP blocks, so docs are mounted first.
  app.use('/docs', ...createDocsHandlers());

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    }),
  );
  app.use(express.json({ limit: env.BODY_LIMIT }));

  app.get('/health', (_req, res) => {
    const db = isDbConnected();
    res.status(db ? 200 : 503).json({
      status: db ? 'ok' : 'degraded',
      db: db ? 'connected' : 'disconnected',
      uptime: Math.round(process.uptime()),
    });
  });

  const v1 = express.Router();
  v1.use('/posts', publicPostsRouter);
  v1.use('/cms/posts', requireBearerToken(env.CMS_API_TOKEN), cmsPostsRouter);
  app.use('/api/v1', v1);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
