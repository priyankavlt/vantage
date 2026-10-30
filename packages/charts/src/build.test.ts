import type { QueryResult } from '@vantage/shared';
import { describe, expect, it } from 'vitest';
import { buildChart, ChartDataError, pivotCartesian, suggestSpec } from './build';
import { THEMES } from './palette';

const result = (
  columns: [string, 'string' | 'integer' | 'date'][],
  rows: unknown[][],
): QueryResult => ({
  columns: columns.map(([name, type]) => ({ name, type, nativeType: type })),
  rows: rows as QueryResult['rows'],
  rowCount: rows.length,
  truncated: false,
  durationMs: 1,
});

const sales = result(
  [
    ['month', 'string'],
    ['region', 'string'],
    ['revenue', 'integer'],
    ['orders', 'integer'],
  ],
  [
    ['Jan', 'north', 10, 1],
    ['Jan', 'south', 20, 2],
    ['Feb', 'north', 15, 3],
    ['Feb', 'south', 5, 4],
  ],
);

describe('pivotCartesian', () => {
  it('makes one series per y column, summing duplicate x values', () => {
    const { categories, series } = pivotCartesian(sales, {
      x: 'month',
      y: ['revenue', 'orders'],
      stacked: false,
    });
    expect(categories).toEqual(['Jan', 'Feb']);
    expect(series).toEqual([
      { name: 'revenue', data: [30, 20] },
      { name: 'orders', data: [3, 7] },
    ]);
  });

  it('splits by a column', () => {
    const { series } = pivotCartesian(sales, {
      x: 'month',
      y: ['revenue'],
      series: 'region',
      stacked: false,
    });
    expect(series).toEqual([
      { name: 'north', data: [10, 15] },
      { name: 'south', data: [20, 5] },
    ]);
  });

  it('folds more than 8 series into Other, keeping first-seen order', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ['Jan', `s${i}`, i + 1]);
    const r = result(
      [
        ['m', 'string'],
        ['s', 'string'],
        ['v', 'integer'],
      ],
      rows,
    );
    const { series } = pivotCartesian(r, { x: 'm', y: ['v'], series: 's', stacked: false });
    expect(series).toHaveLength(8);
    expect(series.at(-1)).toEqual({ name: 'Other', data: [1 + 2 + 3] });
    expect(series[0]?.name).toBe('s3');
  });
});

describe('buildChart', () => {
  it('builds a single-axis bar chart with the categorical palette', () => {
    const built = buildChart(
      { type: 'bar', config: { x: 'month', y: ['revenue'], stacked: false } },
      sales,
    );
    expect(built.kind).toBe('echarts');
    if (built.kind !== 'echarts') return;
    const option = built.option as { yAxis: object; color: string[]; legend: { show?: boolean } };
    expect(Array.isArray(option.yAxis)).toBe(false);
    expect(option.color).toEqual(THEMES.light.categorical);
    expect(option.legend.show).toBe(false); // one series: no legend box
  });

  it('shows a legend for two or more series and uses dark tokens in dark mode', () => {
    const built = buildChart(
      { type: 'line', config: { x: 'month', y: ['revenue'], series: 'region', stacked: false } },
      sales,
      'dark',
    );
    if (built.kind !== 'echarts') throw new Error('expected echarts');
    const option = built.option as { color: string[]; legend: { show?: boolean } };
    expect(option.legend.show).not.toBe(false);
    expect(option.color).toEqual(THEMES.dark.categorical);
  });

  it('aggregates pie slices', () => {
    const built = buildChart({ type: 'pie', config: { label: 'region', value: 'revenue' } }, sales);
    if (built.kind !== 'echarts') throw new Error('expected echarts');
    const data = (built.option as { series: { data: unknown }[] }).series[0]?.data;
    // Equal totals keep first-seen order (stable sort).
    expect(data).toEqual([
      { name: 'north', value: 25 },
      { name: 'south', value: 25 },
    ]);
  });

  it('formats a big number from the first row', () => {
    const r = result([['total', 'integer']], [[1234567]]);
    expect(
      buildChart({ type: 'big-number', config: { value: 'total', caption: 'Revenue' } }, r),
    ).toEqual({
      kind: 'big-number',
      value: '1,234,567',
      caption: 'Revenue',
    });
  });

  it('reports missing columns clearly', () => {
    expect(() =>
      buildChart({ type: 'bar', config: { x: 'nope', y: ['revenue'], stacked: false } }, sales),
    ).toThrow(ChartDataError);
  });
});

describe('suggestSpec', () => {
  it('picks a dimension for x and a measure for y', () => {
    expect(suggestSpec('bar', sales)).toEqual({
      type: 'bar',
      config: { x: 'month', y: ['revenue'], stacked: false },
    });
  });
});
