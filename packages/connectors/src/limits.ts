import { QUERY_LIMITS } from '@vantage/shared';
import type { ExecuteOptions } from './types';

export interface RequestedLimits {
  timeoutMs?: number | undefined;
  maxRows?: number | undefined;
  signal?: AbortSignal | undefined;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Math.trunc(value), min), max);

/** Fill in defaults and clamp to hard caps, so no caller can run an unbounded query. */
export function resolveQueryLimits(requested: RequestedLimits = {}): ExecuteOptions {
  const options: ExecuteOptions = {
    timeoutMs: clamp(
      requested.timeoutMs ?? QUERY_LIMITS.defaultTimeoutMs,
      1,
      QUERY_LIMITS.maxTimeoutMs,
    ),
    maxRows: clamp(requested.maxRows ?? QUERY_LIMITS.defaultMaxRows, 1, QUERY_LIMITS.maxRows),
  };
  if (requested.signal) options.signal = requested.signal;
  return options;
}
