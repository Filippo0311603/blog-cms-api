import type { RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { ApiError } from '../utils/ApiError.js';

type Part = 'params' | 'query' | 'body';
export type RequestSchemas = Partial<Record<Part, ZodType>>;

/**
 * Validates the given parts of the request with zod. Parsed (and normalized) values are
 * stored in `res.locals.validated` because `req.query` is read-only in Express 5.
 * All problems across params/query/body are reported together.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req, res, next) => {
    const validated: Partial<Record<Part, unknown>> = {};
    const details: { location: Part; path: string; message: string }[] = [];

    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (result.success) {
        validated[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          details.push({ location: part, path: issue.path.join('.'), message: issue.message });
        }
      }
    }

    if (details.length > 0) {
      next(ApiError.validation(details));
      return;
    }
    res.locals.validated = validated;
    next();
  };
}

/** Typed accessor for what `validate` stored. */
export function getValidated<T>(res: Response): T {
  return res.locals.validated as T;
}
