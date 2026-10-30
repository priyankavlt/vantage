'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import type { CellValue, Column, QueryResult } from '@vantage/shared';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

const ROW_HEIGHT = 32;
const COL_WIDTH = 180;
const INDEX_WIDTH = 56;

const isNumeric = (c: Column) => c.type === 'integer' || c.type === 'number';

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 });

function formatCell(value: CellValue): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') return numberFormat.format(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return value;
}

/** Virtualized grid: renders only the visible rows, so 100k rows stay smooth. */
export function ResultsTable({ result, className }: { result: QueryResult; className?: string }) {
  const parentRef = useRef<HTMLDivElement>(null);
  // TanStack Virtual returns functions the React Compiler can't memoize; that's expected here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: result.rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });
  const width = INDEX_WIDTH + result.columns.length * COL_WIDTH;
  const template = `${INDEX_WIDTH}px repeat(${result.columns.length}, ${COL_WIDTH}px)`;

  return (
    <div
      ref={parentRef}
      className={cn('relative overflow-auto font-mono text-xs', className)}
      role="grid"
      aria-rowcount={result.rows.length + 1}
      aria-colcount={result.columns.length}
    >
      <div style={{ width }} className="min-w-full">
        <div
          role="row"
          className="bg-muted sticky top-0 z-10 grid border-b font-sans text-xs font-medium"
          style={{ gridTemplateColumns: template, height: ROW_HEIGHT }}
        >
          <div role="columnheader" className="text-muted-foreground px-2 py-2 text-right">
            #
          </div>
          {result.columns.map((col) => (
            <div
              key={col.name}
              role="columnheader"
              className={cn('truncate border-l px-2 py-2', isNumeric(col) && 'text-right')}
              title={`${col.name} (${col.nativeType})`}
            >
              {col.name}
              <span className="text-muted-foreground ml-1 font-normal">{col.nativeType}</span>
            </div>
          ))}
        </div>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = result.rows[item.index] ?? [];
            return (
              <div
                key={item.key}
                role="row"
                aria-rowindex={item.index + 2}
                className="border-border/60 hover:bg-accent/40 absolute grid w-full border-b"
                style={{
                  gridTemplateColumns: template,
                  height: ROW_HEIGHT,
                  transform: `translateY(${item.start}px)`,
                }}
              >
                <div role="cell" className="text-muted-foreground px-2 py-2 text-right">
                  {item.index + 1}
                </div>
                {result.columns.map((col, i) => {
                  const value = row[i] ?? null;
                  const text = formatCell(value);
                  return (
                    <div
                      key={col.name}
                      role="cell"
                      title={text}
                      className={cn(
                        'border-border/60 truncate border-l px-2 py-2',
                        isNumeric(col) && 'text-right tabular-nums',
                        value === null && 'text-muted-foreground italic',
                      )}
                    >
                      {text}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      {result.rows.length === 0 && (
        <p className="text-muted-foreground p-4 font-sans text-sm">The query returned no rows.</p>
      )}
    </div>
  );
}
