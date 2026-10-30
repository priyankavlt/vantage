'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  chartSchema,
  queryResultSchema,
  type CreateChartRequest,
  type UpdateChartRequest,
} from '@vantage/shared';
import { z } from 'zod';
import { api } from '@/lib/api';

const keys = {
  list: (ws: string) => ['charts', ws] as const,
  one: (ws: string, id: string) => ['charts', ws, id] as const,
  data: (ws: string, id: string) => ['charts', ws, id, 'data'] as const,
};

export function useCharts(workspaceId: string) {
  return useQuery({
    queryKey: keys.list(workspaceId),
    queryFn: () => api(`/workspaces/${workspaceId}/charts`, z.array(chartSchema)),
  });
}

export function useChart(workspaceId: string, id: string | undefined) {
  return useQuery({
    queryKey: keys.one(workspaceId, id ?? ''),
    queryFn: () => api(`/workspaces/${workspaceId}/charts/${id ?? ''}`, chartSchema),
    enabled: Boolean(id),
  });
}

/** Rows for a saved chart (runs its query). `refetchInterval` powers dashboard auto-refresh. */
export function useChartData(workspaceId: string, id: string, refetchInterval?: number | false) {
  return useQuery({
    queryKey: keys.data(workspaceId, id),
    queryFn: ({ signal }) =>
      api(`/workspaces/${workspaceId}/charts/${id}/data`, queryResultSchema, { signal }),
    refetchInterval: refetchInterval ?? false,
    staleTime: 60_000,
  });
}

export function useCreateChart(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateChartRequest) =>
      api(`/workspaces/${workspaceId}/charts`, chartSchema, { method: 'POST', json: body }),
    onSuccess: (chart) => {
      qc.setQueryData(keys.one(workspaceId, chart.id), chart);
      return qc.invalidateQueries({ queryKey: keys.list(workspaceId) });
    },
  });
}

export function useUpdateChart(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateChartRequest & { id: string }) =>
      api(`/workspaces/${workspaceId}/charts/${id}`, chartSchema, { method: 'PATCH', json: body }),
    onSuccess: (chart) => {
      qc.setQueryData(keys.one(workspaceId, chart.id), chart);
      return qc.invalidateQueries({ queryKey: keys.list(workspaceId) });
    },
  });
}

export function useDeleteChart(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/workspaces/${workspaceId}/charts/${id}`, z.null(), { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list(workspaceId) }),
  });
}
