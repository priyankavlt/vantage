import { QUERY_LIMITS } from '@vantage/shared';
import { describe, expect, it } from 'vitest';
import { resolveQueryLimits } from './limits';

describe('resolveQueryLimits', () => {
  it('applies defaults when nothing is requested', () => {
    expect(resolveQueryLimits()).toEqual({
      timeoutMs: QUERY_LIMITS.defaultTimeoutMs,
      maxRows: QUERY_LIMITS.defaultMaxRows,
    });
  });

  it('clamps values above the hard caps', () => {
    const limits = resolveQueryLimits({ timeoutMs: 10 ** 9, maxRows: 10 ** 9 });
    expect(limits.timeoutMs).toBe(QUERY_LIMITS.maxTimeoutMs);
    expect(limits.maxRows).toBe(QUERY_LIMITS.maxRows);
  });

  it('never allows zero or negative limits', () => {
    const limits = resolveQueryLimits({ timeoutMs: 0, maxRows: -5 });
    expect(limits.timeoutMs).toBe(1);
    expect(limits.maxRows).toBe(1);
  });
});
