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
