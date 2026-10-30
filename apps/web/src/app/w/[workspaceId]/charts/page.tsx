'use client';

import { BarChart3, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { PageHeader } from '@/components/app-shell';
import { ErrorMessage } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useCharts, useDeleteChart } from '@/hooks/use-charts';
import { useSavedQueries } from '@/hooks/use-queries';

export default function ChartsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const { data, isPending, error } = useCharts(workspaceId);
  const queries = useSavedQueries(workspaceId);
  const remove = useDeleteChart(workspaceId);
  const base = `/w/${workspaceId}/charts`;
  const queryName = (id: string) => queries.data?.find((q) => q.id === id)?.name ?? '';

  const newButton = (
    <Button asChild>
      <Link href={`${base}/new` as never}>
        <Plus /> New chart
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Charts"
        description="Visualizations of saved queries."
        actions={newButton}
      />
      <div className="flex flex-col gap-4 px-8 py-6">
        <ErrorMessage>{error?.message ?? remove.error?.message}</ErrorMessage>
        {isPending && <p className="text-muted-foreground text-sm">Loading…</p>}
        {data?.length === 0 && (
          <EmptyState
            icon={<BarChart3 className="size-8" />}
            title="No charts yet"
            description="Pick a saved query, choose a chart type, and map its columns."
            action={newButton}
          />
        )}
        {data && data.length > 0 && (
          <ul className="divide-y rounded-xl border">
            {data.map((c) => (
              <li key={c.id} className="flex items-center gap-4 px-5 py-3">
                <Link href={`${base}/${c.id}` as never} className="min-w-0 flex-1">
                  <p className="font-medium hover:underline">{c.name}</p>
                  <p className="text-muted-foreground truncate text-sm">
                    {c.spec.type} · {queryName(c.queryId)}
                  </p>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${c.name}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete "${c.name}"?`)) remove.mutate(c.id);
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
