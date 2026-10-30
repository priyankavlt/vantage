'use client';

import { useQuery } from '@tanstack/react-query';
import { publicDashboardSchema, queryResultSchema } from '@vantage/shared';
import { use } from 'react';
import { ChartTile } from '@/components/chart-tile';
import { DashboardGrid } from '@/components/dashboard-grid';
import { Providers } from '@/components/providers';
import { api } from '@/lib/api';

function PublicDashboard({ token }: { token: string }) {
  const dashboard = useQuery({
    queryKey: ['public', token],
    queryFn: () => api(`/public/dashboards/${encodeURIComponent(token)}`, publicDashboardSchema),
    retry: false,
  });

  if (dashboard.error) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-2 text-center">
        <p className="font-medium">This dashboard isn&apos;t available.</p>
        <p className="text-muted-foreground text-sm">The link may have been turned off.</p>
      </main>
    );
  }
  if (!dashboard.data) {
    return <p className="text-muted-foreground p-8 text-sm">Loading…</p>;
  }
  const { name, items, charts, refreshIntervalSeconds } = dashboard.data;
  const byId = new Map(charts.map((c) => [c.id, c]));

  return (
    <main className="bg-muted/30 min-h-dvh">
      <header className="bg-background flex items-center gap-3 border-b px-8 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static svg */}
        <img src="/icon.svg" alt="" width={22} height={22} />
        <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
        {refreshIntervalSeconds && (
          <span className="text-muted-foreground ml-auto text-xs">
            Refreshes every{' '}
            {refreshIntervalSeconds >= 3600 ? 'hour' : `${refreshIntervalSeconds / 60} min`}
          </span>
        )}
      </header>
      <div className="px-4 py-2">
        <DashboardGrid
          items={items}
          editing={false}
          renderTile={(item) => {
            const chart = byId.get(item.chartId);
            return (
              <ChartTile
                title={chart?.name ?? 'Chart'}
                spec={chart?.spec}
                queryKey={['public', token, item.chartId]}
                fetchData={(signal) =>
                  api(
                    `/public/dashboards/${encodeURIComponent(token)}/charts/${item.chartId}/data`,
                    queryResultSchema,
                    { signal },
                  )
                }
                refreshMs={refreshIntervalSeconds ? refreshIntervalSeconds * 1000 : false}
              />
            );
          }}
        />
      </div>
      <footer className="text-muted-foreground px-8 py-6 text-center text-xs">
        Made with Vantage
      </footer>
    </main>
  );
}

export default function PublicDashboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return (
    <Providers>
      <PublicDashboard token={token} />
    </Providers>
  );
}
