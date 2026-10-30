import { apiErrorSchema } from '@vantage/shared';
import type { z } from 'zod';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** Fetch JSON from the Vantage API and validate the response with `schema`. */
export async function api<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers: initHeaders, ...rest } = init;
  const headers = new Headers(initHeaders);
  if (json !== undefined) headers.set('content-type', 'application/json');
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...rest,
    headers,
    ...(json === undefined ? {} : { body: JSON.stringify(json) }),
  });
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    throw parsed.success
      ? new ApiRequestError(res.status, parsed.data.error.code, parsed.data.error.message)
      : new ApiRequestError(res.status, 'HTTP_ERROR', `Request failed (${res.status})`);
  }
  return schema.parse(body);
}
