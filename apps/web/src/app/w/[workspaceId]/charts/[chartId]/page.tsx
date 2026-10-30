'use client';

import { use } from 'react';
import { ChartBuilder } from '@/components/chart-builder';
import { ErrorMessage } from '@/components/ui/alert';
import { useChart } from '@/hooks/use-charts';

export default function ChartPage({
  params,
}: {
  params: Promise<{ workspaceId: string; chartId: string }>;
}) {
  const { workspaceId, chartId } = use(params);
  const { data, error, isPending } = useChart(workspaceId, chartId);
  return (
    <div className="flex h-dvh flex-col">
      {isPending && <p className="text-muted-foreground p-8 text-sm">Loading…</p>}
      {error && (
        <div className="p-8">
          <ErrorMessage>{error.message}</ErrorMessage>
        </div>
      )}
      {data && <ChartBuilder key={data.id} workspaceId={workspaceId} chart={data} />}
    </div>
  );
}
