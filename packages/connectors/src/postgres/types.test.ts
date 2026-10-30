import { describe, expect, it } from 'vitest';
import { normalizeSql, privilegeWarnings } from './connection';
import { describeOid, toCell } from './types';

describe('postgres value mapping', () => {
  it('maps known OIDs', () => {
    expect(describeOid(23)).toEqual({ nativeType: 'int4', type: 'integer' });
    expect(describeOid(1184)).toEqual({ nativeType: 'timestamptz', type: 'datetime' });
    expect(describeOid(999_999)).toEqual({ nativeType: 'oid:999999', type: 'unknown' });
  });

  it('converts int8 and numeric strings to numbers when safe', () => {
    expect(toCell('42', 'integer')).toBe(42);
    expect(toCell('9007199254740993', 'integer')).toBe('9007199254740993');
    expect(toCell('3.14', 'number')).toBe(3.14);
    expect(toCell('abc', 'string')).toBe('abc');
  });

  it('serializes dates, buffers and objects', () => {
    expect(toCell(new Date('2026-01-02T03:04:05.000Z'), 'datetime')).toBe(
      '2026-01-02T03:04:05.000Z',
    );
    expect(toCell('2026-01-02', 'date')).toBe('2026-01-02');
    expect(toCell('2026-01-02 03:04:05', 'datetime')).toBe('2026-01-02T03:04:05');
    expect(toCell(Buffer.from([1, 255]), 'string')).toBe('\\x01ff');
    expect(toCell({ a: 1 }, 'json')).toBe('{"a":1}');
    expect(toCell(null, 'string')).toBeNull();
  });

  it('strips trailing semicolons', () => {
    expect(normalizeSql('select 1;  \n;')).toBe('select 1');
  });
});

describe('privilegeWarnings', () => {
  const none = {
    superuser: false,
    exec_program: false,
    server_files: false,
    signal_backend: false,
  };

  it('is quiet for a least-privilege role', () => {
    expect(privilegeWarnings(none)).toEqual([]);
  });

  it('warns about superusers and dangerous roles', () => {
    expect(privilegeWarnings({ ...none, superuser: true })[0]).toMatch(/superuser/);
    expect(privilegeWarnings({ ...none, exec_program: true, signal_backend: true })).toHaveLength(
      2,
    );
  });
});
