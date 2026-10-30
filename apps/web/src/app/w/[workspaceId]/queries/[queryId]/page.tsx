'use client';

import { use } from 'react';
import { QueryWorkbench } from '@/components/query-workbench';
import { ErrorMessage } from '@/components/ui/alert';
import { useSavedQuery } from '@/hooks/use-queries';

export default function SavedQueryPage({
  params,
}: {
  params: Promise<{ workspaceId: string; queryId: string }>;
}) {
  const { workspaceId, queryId } = use(params);
  const { data, error, isPending } = useSavedQuery(workspaceId, queryId);

  return (
    <div className="flex h-dvh flex-col">
      {isPending && <p className="text-muted-foreground p-8 text-sm">Loading…</p>}
      {error && (
        <div className="p-8">
          <ErrorMessage>{error.message}</ErrorMessage>
        </div>
      )}
      {/* key: remount when switching queries so editor state resets */}
      {data && <QueryWorkbench key={data.id} workspaceId={workspaceId} saved={data} />}
    </div>
  );
}
