import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RequestHandler, Response } from 'express';

export const REQUEST_ID_HEADER = 'X-Request-Id';

// Only short, printable tokens are echoed back: anything else could pollute logs and headers.
const SAFE_REQUEST_ID = /^[\w.:-]{1,128}$/;

/** Reuses a well-formed incoming `X-Request-Id`, otherwise generates a UUID. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get(REQUEST_ID_HEADER);
  const id = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.locals.requestId = id;
  res.set(REQUEST_ID_HEADER, id);
  next();
};

/** The id assigned by the `requestId` middleware, if it ran. */
export const getRequestId = (res: Response): string | undefined =>
  res.locals.requestId as string | undefined;

/** pino-http `genReqId`: log lines carry the same id that is sent back to the client. */
export const genReqId = (_req: IncomingMessage, res: ServerResponse): string =>
  (res as Response).locals.requestId as string;
