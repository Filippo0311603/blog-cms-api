import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { ApiError } from '../utils/ApiError.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest();

/** Constant-time comparison: hashing first gives equal-length buffers for any input. */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

/** Requires `Authorization: Bearer <token>` matching the configured CMS token. */
export function requireBearerToken(expectedToken: string): RequestHandler {
  return (req, _res, next) => {
    const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') ?? '');
    if (!match?.[1] || !safeEqual(match[1], expectedToken)) {
      next(ApiError.unauthorized());
      return;
    }
    next();
  };
}
