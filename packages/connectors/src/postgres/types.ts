import type { CellValue, ColumnType } from '@vantage/shared';

/**
 * Built-in Postgres type OIDs we map explicitly. Anything else is reported
 * as `unknown` with its OID so the UI can still show it as text.
 * Source: `select oid, typname from pg_type` (stable across versions).
 */
const OID_TYPES: Record<number, { name: string; type: ColumnType }> = {
  16: { name: 'bool', type: 'boolean' },
  17: { name: 'bytea', type: 'string' },
  18: { name: 'char', type: 'string' },
  19: { name: 'name', type: 'string' },
  20: { name: 'int8', type: 'integer' },
  21: { name: 'int2', type: 'integer' },
  23: { name: 'int4', type: 'integer' },
  25: { name: 'text', type: 'string' },
  26: { name: 'oid', type: 'integer' },
  114: { name: 'json', type: 'json' },
  700: { name: 'float4', type: 'number' },
  701: { name: 'float8', type: 'number' },
  790: { name: 'money', type: 'string' },
  1042: { name: 'bpchar', type: 'string' },
  1043: { name: 'varchar', type: 'string' },
  1082: { name: 'date', type: 'date' },
  1083: { name: 'time', type: 'string' },
  1114: { name: 'timestamp', type: 'datetime' },
  1184: { name: 'timestamptz', type: 'datetime' },
  1186: { name: 'interval', type: 'string' },
  1266: { name: 'timetz', type: 'string' },
  1700: { name: 'numeric', type: 'number' },
  2950: { name: 'uuid', type: 'string' },
  3802: { name: 'jsonb', type: 'json' },
};

export function describeOid(oid: number): { nativeType: string; type: ColumnType } {
  const known = OID_TYPES[oid];
  return known
    ? { nativeType: known.name, type: known.type }
    : { nativeType: `oid:${oid}`, type: 'unknown' };
}

/** Convert a value from node-postgres into a JSON-safe cell for `type`. */
export function toCell(value: unknown, type: ColumnType): CellValue {
  if (value === null || value === undefined) return null;
  switch (typeof value) {
    case 'boolean':
      return value;
    case 'number':
      return Number.isFinite(value) ? value : String(value);
    case 'bigint':
      return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
    case 'string': {
      // int8 and numeric arrive as strings. Charts need numbers, so convert
      // when it does not lose integer precision.
      if (type === 'integer' || type === 'number') {
        const n = Number(value);
        if (Number.isFinite(n) && (type === 'number' || Number.isSafeInteger(n))) return n;
      }
      // `timestamp` (no zone) arrives as '2026-01-02 03:04:05'; make it ISO-like.
      if (type === 'datetime') return value.replace(' ', 'T');
      return value;
    }
    default:
      break;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString();
  }
  if (Buffer.isBuffer(value)) return `\\x${value.toString('hex')}`;
  return JSON.stringify(value);
}
