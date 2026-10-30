import type { CellValue } from '@vantage/shared';

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/** Axis ticks: 1.2K, 3.4M. */
export const formatCompact = (n: number): string => compact.format(n);

/** Tooltips and big numbers: 1,234.56. */
export const formatNumber = (n: number): string => full.format(n);

export function toNumber(value: CellValue): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  return null;
}

export const toLabel = (value: CellValue): string =>
  value === null ? '(empty)' : typeof value === 'number' ? formatNumber(value) : String(value);
