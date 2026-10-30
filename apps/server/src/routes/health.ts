import { healthResponseSchema } from '@vantage/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

export const healthRoutes: FastifyPluginAsyncZod<{ version: string }> = (app, opts) => {
  app.get('/health', { schema: { response: { 200: healthResponseSchema } } }, () => ({
    status: 'ok' as const,
    version: opts.version,
  }));
  return Promise.resolve();
};
