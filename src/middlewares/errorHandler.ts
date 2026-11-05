import { STATUS_CODES } from 'node:http';
import type { ErrorRequestHandler } from 'express';
import { env } from '../config/env.js';
import { getRequestId } from './requestId.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

/** http-errors style error, as thrown by body-parser, the Express router, etc. */
interface HttpLikeError extends Error {
  type?: string;
  status?: number;
  statusCode?: number;
  expose?: boolean;
}

const CLIENT_ERROR_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  404: 'NOT_FOUND',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
};

/** Maps any thrown value to an ApiError, or null when it is an unexpected (500) error. */
function toApiError(err: unknown): ApiError | null {
  if (err instanceof ApiError) return err;

  const httpError = err as HttpLikeError | null;

  // A malformed percent-encoding in the path (e.g. /posts/%zz) can never match a resource.
  // Only the router's decode error (it sets status 400) is mapped; other URIErrors are bugs (500).
  if (err instanceof URIError && (httpError?.status === 400 || httpError?.statusCode === 400)) {
    return ApiError.notFound('Resource not found');
  }

  if (httpError?.type === 'entity.parse.failed') return ApiError.badRequest('Malformed JSON body');

  // Any other 4xx raised by the framework (bad gzip body, unsupported charset, ...) is the
  // client's fault: keep its status, and only show its message when it is safe to expose.
  const status = httpError?.status ?? httpError?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    const message = httpError?.expose ? httpError.message : (STATUS_CODES[status] ?? 'Bad Request');
    return new ApiError(status, CLIENT_ERROR_CODES[status] ?? 'CLIENT_ERROR', message);
  }
  return null;
}

// Express identifies error middleware by its 4-argument signature, so `_next` must stay.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const apiError = toApiError(err);
  const requestId = getRequestId(res);
  // Errors are never cacheable, whatever route they came from.
  res.set('Cache-Control', 'no-store');

  if (!apiError) {
    logger.error({ err, requestId, method: req.method, url: req.originalUrl }, 'Unhandled error');
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        ...(requestId ? { requestId } : {}),
        // Stack traces are only ever exposed in development.
        ...(env.NODE_ENV === 'development' && err instanceof Error
          ? { details: { stack: err.stack } }
          : {}),
      },
    });
    return;
  }

  if (apiError.headers) res.set(apiError.headers);
  res.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(requestId ? { requestId } : {}),
      ...(apiError.details !== undefined ? { details: apiError.details } : {}),
    },
  });
};
