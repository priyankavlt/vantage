import { z } from 'zod';

export const savedQueryNameSchema = z.string().trim().min(1).max(200);
export const savedQuerySqlSchema = z.string().max(100_000);

export const savedQuerySchema = z.object({
  id: z.string(),
  name: z.string(),
  sql: z.string(),
  dataSourceId: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type SavedQuery = z.infer<typeof savedQuerySchema>;

export const createSavedQueryRequestSchema = z.object({
  name: savedQueryNameSchema,
  sql: savedQuerySqlSchema,
  dataSourceId: z.string().nullable(),
});
export type CreateSavedQueryRequest = z.infer<typeof createSavedQueryRequestSchema>;

export const updateSavedQueryRequestSchema = createSavedQueryRequestSchema.partial();
export type UpdateSavedQueryRequest = z.infer<typeof updateSavedQueryRequestSchema>;
