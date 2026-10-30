'use client';

import { api } from '@/lib/api';
import {
  queryResultSchema,
  REFRESH_INTERVALS,
  type Chart,
  type DashboardItem,
} from '@vantage/shared';
import { Check, Copy, Link2, Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, use, useEffect, useRef, useState } from 'react';
import { ChartTile } from '@/components/chart-tile';
import { DashboardGrid } from '@/components/dashboard-grid';
import { ErrorMessage } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { NativeSelect } from '@/components/ui/select';
import { useCharts } from '@/hooks/use-charts';
import { useDashboard, useShareDashboard, useUpdateDashboard } from '@/hooks/use-dashboards';

const REFRESH_LABELS: Record<(typeof REFRESH_INTERVALS)[number], string> = {
  60: 'Every minute',
  300: 'Every 5 minutes',
  900: 'Every 15 minutes',
  3600: 'Every hour',
};

/** Default tile size: headline numbers are small, everything else half-width. */
const sizeFor = (chart: Chart | undefined) =>
  chart?.spec.type === 'big-number' ? { w: 3, h: 2 } : { w: 6, h: 4 };

function ShareControls({
  workspaceId,
  dashboardId,
  token,
}: {
  workspaceId: string;
  dashboardId: string;
  token: string | null;
}) {
  const share = useShareDashboard(workspaceId, dashboardId);
  const [copied, setCopied] = useState(false);
  const url = token ? `${window.location.origin}/s/${token}` : null;

  if (!url) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          share.mutate(true);
        }}
        disabled={share.isPending}
      >
        <Link2 /> Share publicly
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          void navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => {
              setCopied(false);
            }, 2000);
          });
        }}
        title={url}
      >
        {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy public link'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (window.confirm('Turn off the public link? Anyone using it will lose access.'))
            share.mutate(false);
        }}
        disabled={share.isPending}
      >
        Stop sharing
      </Button>
    </div>
  );
}

function DashboardEditor({
  workspaceId,
  dashboardId,
}: {
  workspaceId: string;
  dashboardId: string;
}) {
  const search = useSearchParams();
  const dashboard = useDashboard(workspaceId, dashboardId);
  const charts = useCharts(workspaceId);
  const update = useUpdateDashboard(workspaceId, dashboardId);
  const [editing, setEditing] = useState(search.get('edit') === '1');
  const [draft, setDraft] = useState<DashboardItem[] | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const items = draft ?? dashboard.data?.items ?? [];
  const chartById = new Map(charts.data?.map((c) => [c.id, c]));
  const refresh = dashboard.data?.refreshIntervalSeconds ?? null;

  // Debounce layout saves while dragging and resizing.
  function persist(next: DashboardItem[]) {
    setDraft(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      update.mutate(
        { items: next },
        {
          onSuccess: () => {
            setDraft(null);
          },
        },
      );
    }, 500);
  }
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  function addChart(chartId: string) {
    const bottom = items.reduce((max, i) => Math.max(max, i.y + i.h), 0);
    persist([
      ...items,
      {
        i: crypto.randomUUID().slice(0, 8),
        chartId,
        x: 0,
        y: bottom,
        ...sizeFor(chartById.get(chartId)),
      },
    ]);
  }

  if (dashboard.error)
    return (
      <div className="p-8">
        <ErrorMessage>{dashboard.error.message}</ErrorMessage>
      </div>
    );
  if (!dashboard.data) return <p className="text-muted-foreground p-8 text-sm">Loading…</p>;

  return (
    <>
      <header className="flex flex-wrap items-center gap-3 border-b px-8 py-4">
        <h1 className="mr-auto text-2xl font-semibold tracking-tight">{dashboard.data.name}</h1>
        <NativeSelect
          aria-label="Auto-refresh"
          className="h-8 w-44"
          value={refresh ?? ''}
          onChange={(e) => {
            const v =
              e.target.value === ''
                ? null
                : (Number(e.target.value) as (typeof REFRESH_INTERVALS)[number]);
            update.mutate({ refreshIntervalSeconds: v });
          }}
        >
          <option value="">Auto-refresh off</option>
          {REFRESH_INTERVALS.map((s) => (
            <option key={s} value={s}>
              {REFRESH_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
        <ShareControls
          workspaceId={workspaceId}
          dashboardId={dashboardId}
          token={dashboard.data.shareToken}
        />
        <Button
          size="sm"
          variant={editing ? 'default' : 'outline'}
          onClick={() => {
            setEditing((e) => !e);
          }}
        >
          {editing ? <Check /> : <Pencil />} {editing ? 'Done' : 'Edit'}
        </Button>
      </header>

      {editing && (
        <div className="bg-muted/30 flex items-center gap-2 border-b px-8 py-2 text-sm">
          <Plus className="text-muted-foreground size-4" />
          <NativeSelect
            aria-label="Add a chart"
            className="h-8 w-72"
            value=""
            onChange={(e) => {
              if (e.target.value) addChart(e.target.value);
            }}
          >
            <option value="">Add a chart…</option>
            {charts.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
          <span className="text-muted-foreground">
            Drag tiles by the handle; resize from the corner.
          </span>
          {charts.data?.length === 0 && (
            <Link className="font-medium underline" href={`/w/${workspaceId}/charts/new` as never}>
              Create a chart
            </Link>
          )}
        </div>
      )}
      <ErrorMessage className="mx-8 mt-4">{update.error?.message}</ErrorMessage>

      <div className="px-4 py-2">
        {items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="This dashboard is empty"
              description={editing ? 'Use “Add a chart” above.' : 'Click Edit to add charts.'}
            />
          </div>
        ) : (
          <DashboardGrid
            items={items}
            editing={editing}
            onChange={persist}
            renderTile={(item) => {
              const chart = chartById.get(item.chartId);
              return (
                <ChartTile
                  title={chart?.name ?? 'Chart'}
                  spec={chart?.spec}
                  queryKey={['charts', workspaceId, item.chartId, 'data']}
                  fetchData={(signal) =>
                    api(
                      `/workspaces/${workspaceId}/charts/${item.chartId}/data`,
                      queryResultSchema,
                      { signal },
                    )
                  }
                  refreshMs={refresh ? refresh * 1000 : false}
                  editing={editing}
                  onRemove={() => {
                    persist(items.filter((i) => i.i !== item.i));
                  }}
                  titleHref={
                    chart && !editing ? (
                      <Link
                        className="hover:underline"
                        href={`/w/${workspaceId}/charts/${chart.id}` as never}
                      >
                        {chart.name}
                      </Link>
                    ) : undefined
                  }
                />
              );
            }}
          />
        )}
      </div>
    </>
  );
}

export default function DashboardPage({
  params,
}: {
  params: Promise<{ workspaceId: string; dashboardId: string }>;
}) {
  const { workspaceId, dashboardId } = use(params);
  return (
    <Suspense>
      <DashboardEditor key={dashboardId} workspaceId={workspaceId} dashboardId={dashboardId} />
    </Suspense>
  );
}
