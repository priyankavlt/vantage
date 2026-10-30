'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  queryResultSchema,
  savedQuerySchema,
  type CreateSavedQueryRequest,
  type RunQueryRequest,
  type UpdateSavedQueryRequest,
} from '@vantage/shared';
import { z } from 'zod';
import { api } from '@/lib/api';

const keys = {
  list: (ws: string) => ['queries', ws] as const,
  one: (ws: string, id: string) => ['queries', ws, id] as const,
};

export function useSavedQueries(workspaceId: string) {
  return useQuery({
    queryKey: keys.list(workspaceId),
    queryFn: () => api(`/workspaces/${workspaceId}/queries`, z.array(savedQuerySchema)),
  });
}

export function useSavedQuery(workspaceId: string, id: string | undefined) {
  return useQuery({
    queryKey: keys.one(workspaceId, id ?? ''),
    queryFn: () => api(`/workspaces/${workspaceId}/queries/${id ?? ''}`, savedQuerySchema),
    enabled: Boolean(id),
  });
}

export function runQuery(workspaceId: string, body: RunQueryRequest, signal?: AbortSignal) {
  return api(`/workspaces/${workspaceId}/queries/run`, queryResultSchema, {
    method: 'POST',
    json: body,
    ...(signal ? { signal } : {}),
  });
}

export function useRunQuery(workspaceId: string) {
  return useMutation({
    mutationFn: ({ signal, ...body }: RunQueryRequest & { signal?: AbortSignal }) =>
      runQuery(workspaceId, body, signal),
  });
}

export function useCreateSavedQuery(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSavedQueryRequest) =>
      api(`/workspaces/${workspaceId}/queries`, savedQuerySchema, { method: 'POST', json: body }),
    onSuccess: (saved) => {
      qc.setQueryData(keys.one(workspaceId, saved.id), saved);
      return qc.invalidateQueries({ queryKey: keys.list(workspaceId) });
    },
  });
}

export function useUpdateSavedQuery(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateSavedQueryRequest & { id: string }) =>
      api(`/workspaces/${workspaceId}/queries/${id}`, savedQuerySchema, {
        method: 'PATCH',
        json: body,
      }),
    onSuccess: (saved) => {
      qc.setQueryData(keys.one(workspaceId, saved.id), saved);
      return qc.invalidateQueries({ queryKey: keys.list(workspaceId) });
    },
  });
}

export function useDeleteSavedQuery(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/workspaces/${workspaceId}/queries/${id}`, z.null(), { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list(workspaceId) }),
  });
}
