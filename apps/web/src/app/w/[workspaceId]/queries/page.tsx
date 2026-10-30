'use client';

import { Plus, TerminalSquare, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { PageHeader } from '@/components/app-shell';
import { ErrorMessage } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useDataSources } from '@/hooks/use-data-sources';
import { useDeleteSavedQuery, useSavedQueries } from '@/hooks/use-queries';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function QueriesPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const { data, isPending, error } = useSavedQueries(workspaceId);
  const sources = useDataSources(workspaceId);
  const remove = useDeleteSavedQuery(workspaceId);
  const base = `/w/${workspaceId}/queries`;
  const sourceName = (id: string | null) =>
    sources.data?.find((s) => s.id === id)?.name ?? 'No data source';

  const newButton = (
    <Button asChild>
      <Link href={`${base}/new` as never}>
        <Plus /> New query
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        title="SQL editor"
        description="Saved queries in this workspace."
        actions={newButton}
      />
      <div className="flex flex-col gap-4 px-8 py-6">
        <ErrorMessage>{error?.message ?? remove.error?.message}</ErrorMessage>
        {isPending && <p className="text-muted-foreground text-sm">Loading…</p>}
        {data?.length === 0 && (
          <EmptyState
            icon={<TerminalSquare className="size-8" />}
            title="No saved queries yet"
            description="Write SQL against your data sources and save it to reuse in charts."
            action={newButton}
          />
        )}
        {data && data.length > 0 && (
          <ul className="divide-y rounded-xl border">
            {data.map((q) => (
              <li key={q.id} className="flex items-center gap-4 px-5 py-3">
                <Link href={`${base}/${q.id}` as never} className="min-w-0 flex-1">
                  <p className="font-medium hover:underline">{q.name}</p>
                  <p className="text-muted-foreground truncate font-mono text-xs">{q.sql}</p>
                </Link>
                <div className="text-muted-foreground hidden text-right text-xs sm:block">
                  <p>{sourceName(q.dataSourceId)}</p>
                  <p>Updated {dateFormat.format(new Date(q.updatedAt))}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${q.name}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete "${q.name}"?`)) remove.mutate(q.id);
                  }}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
