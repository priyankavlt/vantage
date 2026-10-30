'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { echarts, type EChartOption } from './echarts';

export interface EChartProps {
  option: EChartOption;
  className?: string;
  style?: CSSProperties;
  /** Accessible description of what the chart shows. */
  ariaLabel: string;
}

/** Low-level ECharts host. Resizes with its container and disposes on unmount. */
export function EChart({ option, className, style, ariaLabel }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = echarts.init(el, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    const observer = new ResizeObserver(() => {
      chart.resize();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{ width: '100%', height: '100%', ...style }}
    />
  );
}
