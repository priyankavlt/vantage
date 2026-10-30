import type { ApiError } from '@vantage/shared';

/** Throw from a route to send a typed `ApiError` response. */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  toBody(): ApiError {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

export const unauthorized = () => new HttpError(401, 'UNAUTHORIZED', 'Sign in required');
export const forbidden = () => new HttpError(403, 'FORBIDDEN', 'You do not have access');
export const notFound = (what: string) => new HttpError(404, 'NOT_FOUND', `${what} not found`);
export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, 'BAD_REQUEST', message, details);
