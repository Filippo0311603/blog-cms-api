import type { RequestHandler } from 'express';
import { ApiError } from '../utils/ApiError.js';

/**
 * Rejects requests that carry a body which is not JSON (415) instead of letting them reach
 * validation as an "undefined" body. Requests without a body pass through.
 */
export const requireJson: RequestHandler = (req, _res, next) => {
  // req.is() returns null when there is no body, false when the type does not match.
  // An explicit empty body (Content-Length: 0) is treated as no body.
  if (req.get('content-length') !== '0' && req.is('application/json') === false) {
    next(new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json'));
    return;
  }
  next();
};
