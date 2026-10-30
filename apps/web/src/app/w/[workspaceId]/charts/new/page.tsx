'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, use } from 'react';
import { ChartBuilder } from '@/components/chart-builder';

function NewChart({ workspaceId }: { workspaceId: string }) {
  const search = useSearchParams();
  return (
    <ChartBuilder workspaceId={workspaceId} initialQueryId={search.get('query') ?? undefined} />
  );
}

export default function NewChartPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  return (
    <div className="flex h-dvh flex-col">
      <Suspense>
        <NewChart workspaceId={workspaceId} />
      </Suspense>
    </div>
  );
}
