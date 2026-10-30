'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  dataSourceSchema,
  schemaInfoSchema,
  testConnectionResultSchema,
  type CreateDataSourceRequest,
  type DataSourceConfig,
} from '@vantage/shared';
import { z } from 'zod';
import { api } from '@/lib/api';

const keys = {
  list: (ws: string) => ['data-sources', ws] as const,
  schema: (ws: string, id: string) => ['data-sources', ws, id, 'schema'] as const,
};

export function useDataSources(workspaceId: string) {
  return useQuery({
    queryKey: keys.list(workspaceId),
    queryFn: () => api(`/workspaces/${workspaceId}/data-sources`, z.array(dataSourceSchema)),
  });
}

export function useDataSourceSchema(workspaceId: string, id: string | undefined) {
  return useQuery({
    queryKey: keys.schema(workspaceId, id ?? ''),
    queryFn: () =>
      api(`/workspaces/${workspaceId}/data-sources/${id ?? ''}/schema`, schemaInfoSchema),
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  });
}

export function useTestConnection(workspaceId: string) {
  return useMutation({
    mutationFn: (body: DataSourceConfig) =>
      api(`/workspaces/${workspaceId}/data-sources/test`, testConnectionResultSchema, {
        method: 'POST',
        json: body,
      }),
  });
}

export function useTestSavedConnection(workspaceId: string) {
  return useMutation({
    mutationFn: (id: string) =>
      api(`/workspaces/${workspaceId}/data-sources/${id}/test`, testConnectionResultSchema, {
        method: 'POST',
      }),
  });
}

export function useCreateDataSource(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDataSourceRequest) =>
      api(`/workspaces/${workspaceId}/data-sources`, dataSourceSchema, {
        method: 'POST',
        json: body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list(workspaceId) }),
  });
}

export function useDeleteDataSource(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/workspaces/${workspaceId}/data-sources/${id}`, z.null(), { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list(workspaceId) }),
  });
}
