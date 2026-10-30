import type { ChartType } from '@vantage/shared';

/** How a chart type is drawn: on an ECharts canvas, or as plain HTML. */
export type RendererKind = 'echarts' | 'table' | 'big-number';

const RENDERERS: Record<ChartType, RendererKind> = {
  bar: 'echarts',
  line: 'echarts',
  area: 'echarts',
  pie: 'echarts',
  table: 'table',
  'big-number': 'big-number',
};

export const rendererFor = (type: ChartType): RendererKind => RENDERERS[type];
