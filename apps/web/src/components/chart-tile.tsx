'use client';

import { useQuery } from '@tanstack/react-query';
import type { ChartSpec, QueryResult } from '@vantage/shared';
import { GripVertical, RefreshCw, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { ChartView } from '@/components/chart-view';
import { cn } from '@/lib/utils';

/** One dashboard tile: title bar + chart, fetching (and auto-refreshing) its own data. */
export function ChartTile({
  title,
  spec,
  queryKey,
  fetchData,
  refreshMs,
  editing = false,
  onRemove,
  titleHref,
}: {
  title: string;
  spec: ChartSpec | undefined;
  queryKey: readonly unknown[];
  fetchData: (signal: AbortSignal) => Promise<QueryResult>;
  refreshMs: number | false;
  editing?: boolean;
  onRemove?: () => void;
  titleHref?: ReactNode;
}) {
  const data = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchData(signal),
    refetchInterval: refreshMs,
    staleTime: 30_000,
    enabled: Boolean(spec),
  });

  return (
    <div className="bg-card flex h-full flex-col overflow-hidden rounded-xl border shadow-xs">
      <div className="flex items-center gap-1 border-b px-3 py-2">
        {editing && (
          <GripVertical
            className="drag-handle text-muted-foreground size-4 shrink-0 cursor-grab"
            aria-label="Drag to move"
          />
        )}
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium">{titleHref ?? title}</h3>
        <RefreshCw
          className={cn(
            'text-muted-foreground size-3.5',
            data.isFetching ? 'animate-spin' : 'hidden',
          )}
          aria-label="Refreshing"
        />
        {editing && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hover:bg-accent hover:text-foreground rounded p-0.5"
            aria-label={`Remove ${title}`}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 p-2">
        {!spec && <p className="text-muted-foreground p-2 text-sm">This chart was deleted.</p>}
        {spec && data.isPending && <p className="text-muted-foreground p-2 text-sm">Loading…</p>}
        {data.error && <p className="text-destructive p-2 text-sm">{data.error.message}</p>}
        {spec && data.data && <ChartView spec={spec} result={data.data} title={title} />}
      </div>
    </div>
  );
}
