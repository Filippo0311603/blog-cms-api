import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RequestHandler } from 'express';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';

// openapi.yaml lives at the project root: two levels above both src/docs and dist/docs.
const specPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../openapi.yaml');

/** Swagger UI at the mount point, plus the raw spec at `<mount>/openapi.json`. */
export function createDocsHandlers(): RequestHandler[] {
  const spec = parse(readFileSync(specPath, 'utf8')) as Record<string, unknown>;
  const json: RequestHandler = (req, res, next) => {
    if (req.path === '/openapi.json') {
      res.json(spec);
      return;
    }
    next();
  };
  return [json, ...swaggerUi.serve, swaggerUi.setup(spec)];
}
