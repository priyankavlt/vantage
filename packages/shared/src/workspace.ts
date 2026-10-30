import { z } from 'zod';

export const workspaceRoleSchema = z.enum(['owner', 'admin', 'member']);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  role: workspaceRoleSchema,
});
export type Workspace = z.infer<typeof workspaceSchema>;
