import { describe, expect, it } from 'vitest';
import { QUERY_LIMITS, runQueryRequestSchema } from './query';

describe('runQueryRequestSchema', () => {
  it('accepts a minimal request', () => {
    const parsed = runQueryRequestSchema.parse({ dataSourceId: 'ds_1', sql: ' select 1 ' });
    expect(parsed.sql).toBe('select 1');
  });

  it('rejects empty SQL', () => {
    expect(runQueryRequestSchema.safeParse({ dataSourceId: 'ds_1', sql: '   ' }).success).toBe(
      false,
    );
  });

  it('rejects limits above the hard caps', () => {
    const tooSlow = {
      dataSourceId: 'ds_1',
      sql: 'select 1',
      timeoutMs: QUERY_LIMITS.maxTimeoutMs + 1,
    };
    const tooBig = { dataSourceId: 'ds_1', sql: 'select 1', maxRows: QUERY_LIMITS.maxRows + 1 };
    expect(runQueryRequestSchema.safeParse(tooSlow).success).toBe(false);
    expect(runQueryRequestSchema.safeParse(tooBig).success).toBe(false);
  });
});
