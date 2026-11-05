import express from 'express';
import { env } from '../config/env.js';

/**
 * JSON body parser (size limit: BODY_LIMIT). Mounted per route, after rate limiting, auth and
 * `requireJson`, so an unauthenticated request is answered 401 without its body being read.
 * Its errors (malformed JSON, 413, unsupported Content-Encoding) go to the shared error handler.
 */
export const jsonBody = express.json({ limit: env.BODY_LIMIT });
