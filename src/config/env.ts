import 'dotenv/config';
import { z } from 'zod';

/** Documented default so the test app works out of the box. Override with CMS_API_TOKEN. */
export const DEFAULT_CMS_API_TOKEN = 'brianfox-cms-token';

// Treat empty strings (e.g. `MONGODB_URI=` in a .env file) as "not set".
const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/**
 * Express `trust proxy` setting: `false`/`true`, a hop count (`1`) or a comma-separated list of
 * trusted addresses/subnets (`loopback, 10.0.0.0/8`). Unset = `false` (ignore X-Forwarded-*).
 */
const trustProxy = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .default('false')
    .transform((value): boolean | number | string => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return /^\d+$/.test(value) ? Number(value) : value;
    }),
);

const positiveInt = (fallback: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(fallback));

const envSchema = z.object({
  NODE_ENV: z.preprocess(
    emptyToUndefined,
    z.enum(['development', 'test', 'production']).default('development'),
  ),
  PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(65535).default(3000)),
  MONGODB_URI: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  CMS_API_TOKEN: z.preprocess(emptyToUndefined, z.string().trim().default(DEFAULT_CMS_API_TOKEN)),
  BODY_LIMIT: z.preprocess(emptyToUndefined, z.string().default('100kb')),
  CORS_ORIGIN: z.preprocess(emptyToUndefined, z.string().default('*')),
  TRUST_PROXY: trustProxy,
  // Fixed-window rate limits per client IP: public reader routes and CMS routes are counted apart.
  RATE_LIMIT_WINDOW_MS: positiveInt(60_000),
  RATE_LIMIT_PUBLIC_MAX: positiveInt(120),
  RATE_LIMIT_CMS_MAX: positiveInt(300),
  // Cache-Control max-age (seconds) of public GETs. 0 (default) = `public, no-cache`: caches must
  // revalidate (cheap 304 via ETag), so a publish or delete is visible immediately.
  PUBLIC_CACHE_MAX_AGE: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).default(0)),
  LOG_LEVEL: z.preprocess(
    emptyToUndefined,
    z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  ),
});

export type Env = z.infer<typeof envSchema>;

/** Parses and validates environment variables; fails fast with a readable message. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}

export const env = loadEnv();
