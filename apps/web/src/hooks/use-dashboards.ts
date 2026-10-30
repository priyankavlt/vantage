'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardSchema, type UpdateDashboardRequest } from '@vantage/shared';
import { z } from 'zod';
import { api } from '@/lib/api';

const keys = {
  list: (ws: string) => ['dashboards', ws] as const,
  one: (ws: string, id: string) => ['dashboards', ws, id] as const,
};

export function useDashboards(workspaceId: string) {
  return useQuery({
    queryKey: keys.list(workspaceId),
    queryFn: () => api(`/workspaces/${workspaceId}/dashboards`, z.array(dashboardSchema)),
  });
}

export function useDashboard(workspaceId: string, id: string) {
  return useQuery({
    queryKey: keys.one(workspaceId, id),
    queryFn: () => api(`/workspaces/${workspaceId}/dashboards/${id}`, dashboardSchema),
  });
}

export function useCreateDashboard(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api(`/workspaces/${workspaceId}/dashboards`, dashboardSchema, {
        method: 'POST',
        json: { name },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list(workspaceId) }),
  });
}

export function useUpdateDashboard(workspaceId: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateDashboardRequest) =>
      api(`/workspaces/${workspaceId}/dashboards/${id}`, dashboardSchema, {
        method: 'PATCH',
        json: body,
      }),
    onSuccess: (d) => {
      qc.setQueryData(keys.one(workspaceId, id), d);
      return qc.invalidateQueries({ queryKey: keys.list(workspaceId) });
    },
  });
}

export function useShareDashboard(workspaceId: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (share: boolean) =>
      api(`/workspaces/${workspaceId}/dashboards/${id}/share`, dashboardSchema, {
        method: share ? 'POST' : 'DELETE',
      }),
    onSuccess: (d) => {
      qc.setQueryData(keys.one(workspaceId, id), d);
    },
  });
}

export function useDeleteDashboard(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/workspaces/${workspaceId}/dashboards/${id}`, z.null(), { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list(workspaceId) }),
  });
}
