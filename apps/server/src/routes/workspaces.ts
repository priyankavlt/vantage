import { organization } from '@vantage/db/schema';
import { workspaceSchema } from '@vantage/shared';
import { eq } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AppContext } from '../context';
import { notFound } from '../errors';
import { requireWorkspace } from '../plugins/auth';

export const workspaceRoutes: FastifyPluginAsyncZod<{ ctx: AppContext }> = (app, { ctx }) => {
  app.get(
    '/workspaces/:workspaceId',
    {
      schema: {
        params: z.object({ workspaceId: z.string() }),
        response: { 200: workspaceSchema },
      },
      preHandler: requireWorkspace(ctx),
    },
    async (request) => {
      const [ws] = await ctx.db
        .select({ id: organization.id, name: organization.name, slug: organization.slug })
        .from(organization)
        .where(eq(organization.id, request.params.workspaceId))
        .limit(1);
      if (!ws) throw notFound('Workspace');
      return { ...ws, role: request.workspace?.role ?? 'member' };
    },
  );
  return Promise.resolve();
};
