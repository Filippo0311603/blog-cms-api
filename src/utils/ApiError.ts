/** Error that is safe to show to API clients. Anything else becomes a generic 500. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly headers?: Record<string, string>;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { details?: unknown; headers?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.headers = options.headers;
  }

  static badRequest(message: string): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message);
  }

  static validation(details: unknown): ApiError {
    return new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', { details });
  }

  static unauthorized(message = 'Missing or invalid bearer token'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message, {
      headers: { 'WWW-Authenticate': 'Bearer realm="BlogCMS"' },
    });
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }
}
