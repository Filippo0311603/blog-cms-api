import 'dotenv/config';
import { z } from 'zod';

/** Documented default so the test app works out of the box. Override with CMS_API_TOKEN. */
export const DEFAULT_CMS_API_TOKEN = 'brianfox-cms-token';

// Treat empty strings (e.g. `MONGODB_URI=` in a .env file) as "not set".
const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

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
