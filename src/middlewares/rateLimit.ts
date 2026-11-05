import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { ApiError } from '../utils/ApiError.js';

export interface RateLimitOptions {
  windowMs: number;
  /** Max requests per client IP in each window. */
  max: number;
}

/**
 * Fixed-window limiter per client IP. Sends the standard `RateLimit-*` headers (and `Retry-After`
 * on 429); the 429 body goes through the shared error handler so it has the usual error shape.
 */
export function createRateLimiter({ windowMs, max }: RateLimitOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-6',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new ApiError(429, 'TOO_MANY_REQUESTS', 'Too many requests, please retry later'));
    },
  });
}
