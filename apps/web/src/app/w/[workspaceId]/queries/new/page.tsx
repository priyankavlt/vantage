'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, use } from 'react';
import { QueryWorkbench } from '@/components/query-workbench';

function NewQuery({ workspaceId }: { workspaceId: string }) {
  const search = useSearchParams();
  return (
    <QueryWorkbench
      workspaceId={workspaceId}
      initialDataSourceId={search.get('dataSource') ?? undefined}
    />
  );
}

export default function NewQueryPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  return (
    <div className="flex h-dvh flex-col">
      <Suspense>
        <NewQuery workspaceId={workspaceId} />
      </Suspense>
    </div>
  );
}
