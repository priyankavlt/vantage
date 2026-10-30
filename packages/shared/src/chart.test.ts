import { describe, expect, it } from 'vitest';
import { chartColumns } from './chart';

describe('chartColumns', () => {
  it('lists only the columns a chart reads', () => {
    expect(
      chartColumns({ type: 'bar', config: { x: 'm', y: ['a', 'b'], series: 's', stacked: false } }),
    ).toEqual(['m', 'a', 'b', 's']);
    expect(chartColumns({ type: 'pie', config: { label: 'l', value: 'v' } })).toEqual(['l', 'v']);
    expect(chartColumns({ type: 'big-number', config: { value: 'v' } })).toEqual(['v']);
    expect(chartColumns({ type: 'table', config: {} })).toBeNull();
  });
});
