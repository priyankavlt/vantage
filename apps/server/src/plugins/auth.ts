import { member } from '@vantage/db/schema';
import { workspaceRoleSchema, type WorkspaceRole } from '@vantage/shared';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Auth } from '../auth';
import type { AppContext } from '../context';
import { forbidden, unauthorized } from '../errors';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
    workspace: { id: string; role: WorkspaceRole } | null;
  }
}

export function toHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    headers.append(key, Array.isArray(value) ? value.join(', ') : value);
  }
  return headers;
}

/** Mount better-auth at /api/auth/* by bridging Fastify to the Fetch API. */
export function registerAuthRoutes(app: FastifyInstance, auth: Auth): void {
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request, reply) {
      const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
      const hasBody = request.method !== 'GET' && request.body !== undefined;
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers: toHeaders(request),
          ...(hasBody ? { body: JSON.stringify(request.body) } : {}),
        }),
      );
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        if (key !== 'set-cookie') reply.header(key, value);
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length > 0) reply.header('set-cookie', cookies);
      return reply.send(response.body ? await response.text() : null);
    },
  });
}

/** Attach `request.user` from the session cookie on every non-auth request. */
export function registerSession(app: FastifyInstance, auth: Auth): void {
  app.decorateRequest('user', null);
  app.decorateRequest('workspace', null);
  app.addHook('onRequest', async (request) => {
    if (
      request.url.startsWith('/api/auth/') ||
      request.url.startsWith('/api/public/') ||
      request.url === '/api/health'
    ) {
      return;
    }
    if (!request.headers.cookie) return;
    const session = await auth.api.getSession({ headers: toHeaders(request) });
    if (session) {
      request.user = { id: session.user.id, email: session.user.email, name: session.user.name };
    }
  });
}

/** preHandler: 401 unless signed in. */
export function requireUser(request: FastifyRequest): Promise<void> {
  return request.user ? Promise.resolve() : Promise.reject(unauthorized());
}

/**
 * preHandler factory: 403 unless the user is a member of `:workspaceId`.
 * Sets `request.workspace` so handlers can scope every query by it.
 */
export function requireWorkspace(ctx: Pick<AppContext, 'db'>) {
  return async (request: FastifyRequest): Promise<void> => {
    if (!request.user) throw unauthorized();
    const { workspaceId } = request.params as { workspaceId?: string };
    if (!workspaceId) throw forbidden();
    const [row] = await ctx.db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, workspaceId), eq(member.userId, request.user.id)))
      .limit(1);
    if (!row) throw forbidden();
    const role = workspaceRoleSchema.safeParse(row.role);
    request.workspace = { id: workspaceId, role: role.success ? role.data : 'member' };
  };
}

/** Throws 403 unless the current workspace role is one of `roles`. */
export function assertRole(request: FastifyRequest, roles: readonly WorkspaceRole[]): void {
  if (!request.workspace || !roles.includes(request.workspace.role)) throw forbidden();
}
