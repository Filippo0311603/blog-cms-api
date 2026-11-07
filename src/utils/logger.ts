import { pino } from 'pino';
import type { LoggerOptions } from 'pino';
import { env } from '../config/env.js';

export const loggerOptions: LoggerOptions = {
  level: env.LOG_LEVEL,
  // Never write credentials to the logs (pino-http logs the request headers).
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    censor: '[REDACTED]',
  },
};

export const logger = pino({
  ...loggerOptions,
  // Human-readable output only in development; plain JSON everywhere else.
  transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
});

/**
 * Compact request/response serializers for the pretty development output: no headers at all.
 * Other environments keep the default serializers, where `loggerOptions.redact` hides credentials.
 */
export const compactHttpSerializers = {
  req: (req: { id?: unknown; method?: string; url?: string }) => ({
    id: req.id,
    method: req.method,
    url: req.url,
  }),
  res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
};
