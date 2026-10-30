import type {
  BigNumberConfig,
  CartesianConfig,
  ChartSpec,
  Column,
  PieConfig,
  QueryResult,
} from '@vantage/shared';
import type { EChartOption } from './echarts';
import { formatCompact, formatNumber, toLabel, toNumber } from './format';
import { MAX_SERIES, THEMES, type ChartTheme, type ColorMode } from './palette';

/** The spec doesn't fit the data (e.g. a mapped column is missing). Safe to show the user. */
export class ChartDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChartDataError';
  }
}

export type BuiltChart =
  | { kind: 'echarts'; option: EChartOption }
  | { kind: 'big-number'; value: string; caption?: string | undefined }
  | { kind: 'table' };

const OTHER = 'Other';

function columnIndex(result: QueryResult, name: string): number {
  const i = result.columns.findIndex((c) => c.name === name);
  if (i < 0) throw new ChartDataError(`Column "${name}" is not in the query results`);
  return i;
}

const isTime = (c: Column | undefined) => c?.type === 'date' || c?.type === 'datetime';

function baseOption(theme: ChartTheme, seriesCount: number): EChartOption {
  const showLegend = seriesCount >= 2;
  return {
    color: [...theme.categorical],
    backgroundColor: 'transparent',
    textStyle: { color: theme.textSecondary, fontFamily: 'inherit' },
    animationDuration: 300,
    legend: showLegend
      ? {
          top: 0,
          left: 0,
          icon: 'roundRect',
          itemWidth: 12,
          itemHeight: 12,
          textStyle: { color: theme.textSecondary },
        }
      : { show: false },
    grid: { top: showLegend ? 36 : 12, right: 12, bottom: 8, left: 8, containLabel: true },
    tooltip: {
      confine: true,
      backgroundColor: theme.surface,
      borderColor: theme.axis,
      textStyle: { color: theme.textPrimary },
      valueFormatter: (v: unknown) => (typeof v === 'number' ? formatNumber(v) : String(v)),
    },
  };
}

function axisStyle(theme: ChartTheme) {
  return {
    axisLine: { lineStyle: { color: theme.axis } },
    axisTick: { show: false },
    axisLabel: { color: theme.textSecondary, hideOverlap: true },
    splitLine: { lineStyle: { color: theme.grid } },
  };
}

interface Series {
  name: string;
  data: (number | null)[];
}

/** Rows → categories (x values in first-seen order) and one value series per y column or pivot value. */
export function pivotCartesian(
  result: QueryResult,
  config: CartesianConfig,
): { categories: string[]; series: Series[] } {
  const xi = columnIndex(result, config.x);
  const yis = config.y.map((y) => columnIndex(result, y));
  const categories: string[] = [];
  const catIndex = new Map<string, number>();
  for (const row of result.rows) {
    const key = toLabel(row[xi] ?? null);
    if (!catIndex.has(key)) {
      catIndex.set(key, categories.length);
      categories.push(key);
    }
  }

  if (config.series === undefined) {
    const series = yis.map((yi, s) => {
      const data: (number | null)[] = Array.from({ length: categories.length }, () => null);
      for (const row of result.rows) {
        const c = catIndex.get(toLabel(row[xi] ?? null)) ?? 0;
        const v = toNumber(row[yi] ?? null);
        if (v !== null) data[c] = (data[c] ?? 0) + v;
      }
      return { name: config.y[s] ?? '', data };
    });
    return { categories, series };
  }

  // Split by a column: one series per distinct value of `series`, for the first y column.
  const si = columnIndex(result, config.series);
  const yi = yis[0] ?? 0;
  const totals = new Map<string, number>();
  for (const row of result.rows) {
    const key = toLabel(row[si] ?? null);
    totals.set(key, (totals.get(key) ?? 0) + Math.abs(toNumber(row[yi] ?? null) ?? 0));
  }
  // Keep the largest series; fold the rest into "Other" so no 9th color is ever needed.
  const ranked = [...totals.keys()].sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0));
  const keep = new Set(ranked.length > MAX_SERIES ? ranked.slice(0, MAX_SERIES - 1) : ranked);
  // Color follows the entity: series order is first appearance, not rank.
  const names: string[] = [];
  for (const row of result.rows) {
    const key = toLabel(row[si] ?? null);
    const name = keep.has(key) ? key : OTHER;
    if (!names.includes(name)) names.push(name);
  }
  if (names.includes(OTHER)) names.push(...names.splice(names.indexOf(OTHER), 1));

  const series = names.map((name) => ({
    name,
    data: Array.from({ length: categories.length }, () => null as number | null),
  }));
  const byName = new Map(series.map((s) => [s.name, s]));
  for (const row of result.rows) {
    const key = toLabel(row[si] ?? null);
    const target = byName.get(keep.has(key) ? key : OTHER);
    const c = catIndex.get(toLabel(row[xi] ?? null)) ?? 0;
    const v = toNumber(row[yi] ?? null);
    if (target && v !== null) target.data[c] = (target.data[c] ?? 0) + v;
  }
  return { categories, series };
}

function buildCartesian(
  type: 'bar' | 'line' | 'area',
  config: CartesianConfig,
  result: QueryResult,
  theme: ChartTheme,
): EChartOption {
  const { categories, series } = pivotCartesian(result, config);
  const xColumn = result.columns[columnIndex(result, config.x)];
  const stack = config.stacked ? 'total' : undefined;
  const axis = axisStyle(theme);

  return {
    ...baseOption(theme, series.length),
    tooltip: {
      ...(baseOption(theme, series.length).tooltip as object),
      trigger: 'axis',
      axisPointer: type === 'bar' ? { type: 'shadow' } : { type: 'line' },
    },
    xAxis: {
      type: 'category',
      data: categories,
      boundaryGap: type === 'bar',
      ...axis,
      splitLine: { show: false },
      axisLabel: { ...axis.axisLabel, ...(isTime(xColumn) ? {} : { interval: 'auto' }) },
    },
    // Exactly one value axis: Vantage never draws dual-axis charts.
    yAxis: {
      type: 'value',
      ...axis,
      axisLine: { show: false },
      axisLabel: { ...axis.axisLabel, formatter: (v: number) => formatCompact(v) },
    },
    series: series.map((s, i) => {
      const isTop = !config.stacked || i === series.length - 1;
      if (type === 'bar') {
        return {
          type: 'bar',
          name: s.name,
          data: s.data,
          stack,
          barMaxWidth: 32,
          // Rounded data end, square at the baseline; a surface-colored edge separates fills.
          itemStyle: {
            borderRadius: isTop ? [4, 4, 0, 0] : 0,
            borderColor: theme.surface,
            borderWidth: config.stacked ? 1 : 0,
          },
          emphasis: { focus: 'series' },
        };
      }
      return {
        type: 'line',
        name: s.name,
        data: s.data,
        stack,
        smooth: false,
        // Points help read sparse lines; on areas the fill already carries the shape.
        showSymbol: type === 'line' && categories.length <= 24,
        symbolSize: 8,
        lineStyle: { width: 2 },
        itemStyle: { borderColor: theme.surface, borderWidth: 2 },
        connectNulls: false,
        ...(type === 'area' ? { areaStyle: { opacity: config.stacked ? 0.55 : 0.18 } } : {}),
        emphasis: { focus: 'series' },
      };
    }),
  };
}

function buildPie(config: PieConfig, result: QueryResult, theme: ChartTheme): EChartOption {
  const li = columnIndex(result, config.label);
  const vi = columnIndex(result, config.value);
  const sums = new Map<string, number>();
  for (const row of result.rows) {
    const v = toNumber(row[vi] ?? null);
    if (v === null || v <= 0) continue;
    const k = toLabel(row[li] ?? null);
    sums.set(k, (sums.get(k) ?? 0) + v);
  }
  const sorted = [...sums.entries()].sort((a, b) => b[1] - a[1]);
  const slices =
    sorted.length > MAX_SERIES
      ? [
          ...sorted.slice(0, MAX_SERIES - 1),
          [OTHER, sorted.slice(MAX_SERIES - 1).reduce((acc, [, v]) => acc + v, 0)] as const,
        ]
      : sorted;

  return {
    ...baseOption(theme, slices.length),
    tooltip: { ...(baseOption(theme, slices.length).tooltip as object), trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['45%', '72%'],
        center: ['50%', slices.length >= 2 ? '56%' : '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: theme.surface, borderWidth: 2, borderRadius: 4 },
        label: {
          color: theme.textSecondary,
          formatter: (p: { name: string; percent?: number }) =>
            `${p.name}: ${String(Math.round((p.percent ?? 0) * 10) / 10)}%`,
        },
        labelLine: { lineStyle: { color: theme.axis } },
        data: slices.map(([name, value]) => ({ name, value })),
      },
    ],
  };
}

function buildBigNumber(config: BigNumberConfig, result: QueryResult): BuiltChart {
  const vi = columnIndex(result, config.value);
  const raw = result.rows[0]?.[vi] ?? null;
  const n = toNumber(raw);
  return {
    kind: 'big-number',
    value: n === null ? toLabel(raw) : formatNumber(n),
    caption: config.caption,
  };
}

/** Turn a chart spec and query result into something renderable. Pure; throws ChartDataError. */
export function buildChart(
  spec: ChartSpec,
  result: QueryResult,
  mode: ColorMode = 'light',
): BuiltChart {
  const theme = THEMES[mode];
  switch (spec.type) {
    case 'bar':
    case 'line':
    case 'area':
      return { kind: 'echarts', option: buildCartesian(spec.type, spec.config, result, theme) };
    case 'pie':
      return { kind: 'echarts', option: buildPie(spec.config, result, theme) };
    case 'big-number':
      return buildBigNumber(spec.config, result);
    case 'table':
      return { kind: 'table' };
  }
}

/** A sensible starting spec for a result: first text/date column as x, numeric columns as y. */
export function suggestSpec(type: ChartSpec['type'], result: QueryResult): ChartSpec {
  const numeric = result.columns.filter((c) => c.type === 'integer' || c.type === 'number');
  const dims = result.columns.filter((c) => !numeric.includes(c));
  const x = dims[0]?.name ?? result.columns[0]?.name ?? 'x';
  const y = numeric[0]?.name ?? result.columns[1]?.name ?? result.columns[0]?.name ?? 'y';
  switch (type) {
    case 'bar':
    case 'line':
    case 'area':
      return { type, config: { x, y: [y], stacked: false } };
    case 'pie':
      return { type, config: { label: x, value: y } };
    case 'big-number':
      return { type, config: { value: y } };
    case 'table':
      return { type, config: {} };
  }
}
