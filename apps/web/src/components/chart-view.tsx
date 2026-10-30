'use client';

import { BigNumber, buildChart, ChartDataError, type BuiltChart } from '@vantage/charts';
import type { ChartSpec, QueryResult } from '@vantage/shared';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { ResultsTable } from '@/components/results-table';
import { useColorMode } from '@/hooks/use-color-mode';

// ECharts needs the DOM; load it in the browser only.
const EChart = dynamic(() => import('@vantage/charts/echart').then((m) => m.EChart), {
  ssr: false,
  loading: () => <div className="bg-muted/50 h-full w-full animate-pulse rounded-md" />,
});

/** Renders any chart spec against a query result. */
export function ChartView({
  spec,
  result,
  title,
}: {
  spec: ChartSpec;
  result: QueryResult;
  /** Used for the accessible description. */
  title: string;
}) {
  const mode = useColorMode();
  const built = useMemo((): BuiltChart | { kind: 'error'; message: string } => {
    try {
      return buildChart(spec, result, mode);
    } catch (error) {
      if (error instanceof ChartDataError) return { kind: 'error', message: error.message };
      throw error;
    }
  }, [spec, result, mode]);

  switch (built.kind) {
    case 'error':
      return (
        <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm">
          {built.message}. Update the chart settings.
        </div>
      );
    case 'table':
      return <ResultsTable result={result} className="h-full" />;
    case 'big-number':
      return <BigNumber value={built.value} caption={built.caption} />;
    case 'echarts':
      return (
        <EChart
          option={built.option}
          ariaLabel={`${title}: ${spec.type} chart of ${result.rowCount} rows`}
        />
      );
  }
}
