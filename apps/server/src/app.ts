import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { ApiError } from '@vantage/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { AppContext } from './context';
import { HttpError } from './errors';
import { registerAuthRoutes, registerSession } from './plugins/auth';
import { chartRoutes } from './routes/charts';
import { dashboardRoutes } from './routes/dashboards';
import { dataSourceRoutes } from './routes/data-sources';
import { healthRoutes } from './routes/health';
import { queryRoutes } from './routes/queries';
import { workspaceRoutes } from './routes/workspaces';

export const VERSION = '0.1.0';

function describeError(error: unknown): { statusCode?: number; code?: string; message: string } {
  if (!(error instanceof Error)) return { message: 'Unknown error' };
  const { statusCode, code } = error as Error & { statusCode?: unknown; code?: unknown };
  return {
    message: error.message,
    ...(typeof statusCode === 'number' && { statusCode }),
    ...(typeof code === 'string' && { code }),
  };
}

export async function buildApp(ctx: AppContext): Promise<FastifyInstance> {
  const { env } = ctx;
  const app = Fastify({
    logger:
      env.NODE_ENV === 'test'
        ? false
        : {
            level: env.LOG_LEVEL,
            // Never log credentials or session tokens.
            redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.secret'],
          },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet);
  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send(error.toBody());
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      const body: ApiError = {
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: error.validation },
      };
      return reply.status(400).send(body);
    }
    const { statusCode, code, message } = describeError(error);
    const status = statusCode ?? 500;
    if (status >= 500) request.log.error(error);
    // Hide internals on server errors; client errors keep their message.
    const body: ApiError = {
      error: {
        code: status >= 500 ? 'INTERNAL_ERROR' : (code ?? 'REQUEST_ERROR'),
        message: status >= 500 ? 'Something went wrong' : message,
      },
    };
    return reply.status(status).send(body);
  });

  app.setNotFoundHandler((request, reply) => {
    const body: ApiError = {
      error: { code: 'NOT_FOUND', message: `Route ${request.method} ${request.url} not found` },
    };
    return reply.status(404).send(body);
  });

  registerAuthRoutes(app, ctx.auth);
  registerSession(app, ctx.auth);

  await app.register(healthRoutes, { prefix: '/api', version: VERSION });
  await app.register(workspaceRoutes, { prefix: '/api', ctx });
  await app.register(dataSourceRoutes, { prefix: '/api', ctx });
  await app.register(queryRoutes, { prefix: '/api', ctx });
  await app.register(chartRoutes, { prefix: '/api', ctx });
  await app.register(dashboardRoutes, { prefix: '/api', ctx });

  return app;
}
