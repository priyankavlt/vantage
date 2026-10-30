'use client';

import { suggestSpec } from '@vantage/charts';
import {
  CHART_TYPES,
  type CartesianConfig,
  type Chart,
  type ChartSpec,
  type ChartType,
  type QueryResult,
} from '@vantage/shared';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  BarChart3,
  Hash,
  LineChart,
  PieChart,
  Save,
  Table2,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChartView } from '@/components/chart-view';
import { ErrorMessage } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { useCreateChart, useUpdateChart } from '@/hooks/use-charts';
import { runQuery, useSavedQueries, useSavedQuery } from '@/hooks/use-queries';
import { cn } from '@/lib/utils';

const TYPE_META: Record<ChartType, { label: string; icon: LucideIcon }> = {
  bar: { label: 'Bar', icon: BarChart3 },
  line: { label: 'Line', icon: LineChart },
  area: { label: 'Area', icon: AreaChart },
  pie: { label: 'Pie', icon: PieChart },
  table: { label: 'Table', icon: Table2 },
  'big-number': { label: 'Number', icon: Hash },
};

function ColumnSelect({
  id,
  label,
  value,
  columns,
  onChange,
  allowNone,
}: {
  id: string;
  label: string;
  value: string | undefined;
  columns: string[];
  onChange: (value: string | undefined) => void;
  allowNone?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        id={id}
        value={value ?? ''}
        onChange={(e) => {
          onChange(e.target.value === '' ? undefined : e.target.value);
        }}
      >
        {allowNone && <option value="">None</option>}
        {columns.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

function CartesianFields({
  config,
  columns,
  numericColumns,
  onChange,
}: {
  config: CartesianConfig;
  columns: string[];
  numericColumns: string[];
  onChange: (config: CartesianConfig) => void;
}) {
  const { series: _series, ...withoutSeries } = config;
  return (
    <>
      <ColumnSelect
        id="x"
        label="X axis"
        value={config.x}
        columns={columns}
        onChange={(x) => {
          onChange({ ...config, x: x ?? config.x });
        }}
      />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Y axis</legend>
        {numericColumns.length === 0 && (
          <p className="text-muted-foreground text-sm">The query has no numeric columns.</p>
        )}
        {numericColumns.map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.y.includes(c)}
              disabled={
                config.series !== undefined && !config.y.includes(c) && config.y.length >= 1
              }
              onChange={(e) => {
                const y = e.target.checked ? [...config.y, c] : config.y.filter((v) => v !== c);
                if (y.length > 0) onChange({ ...config, y });
              }}
            />
            {c}
          </label>
        ))}
      </fieldset>
      <ColumnSelect
        id="series"
        label="Split into series by"
        value={config.series}
        columns={columns.filter((c) => c !== config.x)}
        allowNone
        onChange={(series) => {
          onChange(
            series === undefined ? withoutSeries : { ...config, series, y: config.y.slice(0, 1) },
          );
        }}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.stacked}
          onChange={(e) => {
            onChange({ ...config, stacked: e.target.checked });
          }}
        />
        Stacked
      </label>
    </>
  );
}

function SpecFields({
  spec,
  result,
  onChange,
}: {
  spec: ChartSpec;
  result: QueryResult;
  onChange: (spec: ChartSpec) => void;
}) {
  const columns = result.columns.map((c) => c.name);
  const numeric = result.columns
    .filter((c) => c.type === 'integer' || c.type === 'number')
    .map((c) => c.name);

  switch (spec.type) {
    case 'bar':
    case 'line':
    case 'area':
      return (
        <CartesianFields
          config={spec.config}
          columns={columns}
          numericColumns={numeric}
          onChange={(config) => {
            onChange({ type: spec.type, config });
          }}
        />
      );
    case 'pie':
      return (
        <>
          <ColumnSelect
            id="label"
            label="Slice label"
            value={spec.config.label}
            columns={columns}
            onChange={(label) => {
              onChange({ ...spec, config: { ...spec.config, label: label ?? spec.config.label } });
            }}
          />
          <ColumnSelect
            id="value"
            label="Slice size"
            value={spec.config.value}
            columns={numeric.length > 0 ? numeric : columns}
            onChange={(value) => {
              onChange({ ...spec, config: { ...spec.config, value: value ?? spec.config.value } });
            }}
          />
        </>
      );
    case 'big-number':
      return (
        <>
          <ColumnSelect
            id="value"
            label="Value (first row)"
            value={spec.config.value}
            columns={columns}
            onChange={(value) => {
              onChange({ ...spec, config: { ...spec.config, value: value ?? spec.config.value } });
            }}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="caption">Caption</Label>
            <Input
              id="caption"
              value={spec.config.caption ?? ''}
              onChange={(e) => {
                const { caption: _c, ...rest } = spec.config;
                onChange({
                  ...spec,
                  config: e.target.value ? { ...rest, caption: e.target.value } : rest,
                });
              }}
            />
          </div>
        </>
      );
    case 'table':
      return <p className="text-muted-foreground text-sm">Shows every column of the query.</p>;
  }
}

export function ChartBuilder({
  workspaceId,
  chart,
  initialQueryId,
}: {
  workspaceId: string;
  chart?: Chart | undefined;
  initialQueryId?: string | undefined;
}) {
  const router = useRouter();
  const queries = useSavedQueries(workspaceId);
  const [queryId, setQueryId] = useState(chart?.queryId ?? initialQueryId ?? '');
  const effectiveQueryId = queryId !== '' ? queryId : (queries.data?.[0]?.id ?? '');
  const query = useSavedQuery(workspaceId, effectiveQueryId || undefined);
  const [name, setName] = useState(chart?.name ?? '');
  const [spec, setSpec] = useState<ChartSpec | null>(chart?.spec ?? null);
  const create = useCreateChart(workspaceId);
  const update = useUpdateChart(workspaceId);

  const saved = query.data;
  const result = useQuery({
    queryKey: ['chart-preview', workspaceId, saved?.id, saved?.sql, saved?.dataSourceId],
    queryFn: ({ signal }) =>
      runQuery(
        workspaceId,
        { dataSourceId: saved?.dataSourceId ?? '', sql: saved?.sql ?? '' },
        signal,
      ),
    enabled: Boolean(saved?.dataSourceId),
    staleTime: 60_000,
  });

  // Until the user picks a type, preview a bar chart suggested from the columns.
  const activeSpec: ChartSpec | null =
    spec ?? (result.data ? suggestSpec('bar', result.data) : null);

  function pickType(type: ChartType) {
    if (!result.data) return;
    setSpec(suggestSpec(type, result.data));
  }

  async function save() {
    if (!activeSpec || !effectiveQueryId) return;
    const body = { name: displayName, spec: activeSpec };
    if (chart) {
      await update.mutateAsync({ id: chart.id, ...body });
    } else {
      const created = await create.mutateAsync({ ...body, queryId: effectiveQueryId });
      router.replace(`/w/${workspaceId}/charts/${created.id}` as never);
    }
    setName(body.name);
  }

  const error = create.error ?? update.error;
  const displayName = name.trim() !== '' ? name.trim() : (saved?.name ?? 'Untitled chart');
  const noQueries = queries.data?.length === 0;

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="chart-name">Name</Label>
          <Input
            id="chart-name"
            value={name}
            placeholder={saved?.name ?? 'Untitled chart'}
            onChange={(e) => {
              setName(e.target.value);
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="query">Query</Label>
          <NativeSelect
            id="query"
            value={effectiveQueryId}
            disabled={Boolean(chart)}
            onChange={(e) => {
              setQueryId(e.target.value);
              setSpec(null);
            }}
          >
            {noQueries && <option value="">No saved queries</option>}
            {queries.data?.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Chart type</legend>
          <div className="grid grid-cols-3 gap-2">
            {CHART_TYPES.map((type) => {
              const { label, icon: Icon } = TYPE_META[type];
              const active = activeSpec?.type === type;
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={active}
                  disabled={!result.data}
                  onClick={() => {
                    pickType(type);
                  }}
                  className={cn(
                    'hover:bg-accent flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs disabled:opacity-50',
                    active && 'border-primary bg-accent font-medium',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>
        {activeSpec && result.data && (
          <div className="flex flex-col gap-4">
            <SpecFields spec={activeSpec} result={result.data} onChange={setSpec} />
          </div>
        )}
        <ErrorMessage>{error?.message}</ErrorMessage>
        <Button
          onClick={() => void save()}
          disabled={!activeSpec || create.isPending || update.isPending}
        >
          <Save /> {chart ? 'Save changes' : 'Save chart'}
        </Button>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col p-6">
        <h2 className="mb-4 text-lg font-medium">{displayName}</h2>
        <div className="min-h-0 flex-1 rounded-xl border p-4">
          {noQueries && (
            <p className="text-muted-foreground text-sm">
              Charts are built from saved queries.{' '}
              <Link
                className="font-medium underline"
                href={`/w/${workspaceId}/queries/new` as never}
              >
                Write a query
              </Link>{' '}
              first.
            </p>
          )}
          {saved && !saved.dataSourceId && (
            <p className="text-muted-foreground text-sm">This query has no data source.</p>
          )}
          {result.isFetching && !result.data && (
            <p className="text-muted-foreground text-sm">Running query…</p>
          )}
          <ErrorMessage>{result.error?.message}</ErrorMessage>
          {result.data && activeSpec && (
            <ChartView spec={activeSpec} result={result.data} title={displayName} />
          )}
        </div>
      </section>
    </div>
  );
}
