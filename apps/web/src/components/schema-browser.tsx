'use client';

import type { TableInfo } from '@vantage/shared';
import { ChevronRight, Eye, Table2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';

export function SchemaBrowser({
  tables,
  onPick,
}: {
  tables: TableInfo[];
  /** Called with a qualified name when the user picks a table or column. */
  onPick?: (text: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const bySchema = new Map<string, TableInfo[]>();
    for (const table of tables) {
      const matches =
        !needle ||
        table.name.toLowerCase().includes(needle) ||
        table.columns.some((c) => c.name.toLowerCase().includes(needle));
      if (!matches) continue;
      const list = bySchema.get(table.schema) ?? [];
      list.push(table);
      bySchema.set(table.schema, list);
    }
    return [...bySchema.entries()];
  }, [tables, filter]);

  const toggle = (key: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <Input
        placeholder="Filter tables and columns"
        value={filter}
        onChange={(e) => {
          setFilter(e.target.value);
        }}
        aria-label="Filter tables and columns"
      />
      <div className="min-h-0 flex-1 overflow-auto text-sm">
        {grouped.length === 0 && <p className="text-muted-foreground p-2">No matching tables.</p>}
        {grouped.map(([schema, list]) => (
          <section key={schema} className="py-1">
            <h3 className="text-muted-foreground px-2 py-1 text-xs font-medium tracking-wide uppercase">
              {schema}
            </h3>
            <ul>
              {list.map((table) => {
                const key = `${table.schema}.${table.name}`;
                const isOpen = open.has(key) || Boolean(filter);
                const Icon = table.kind === 'table' ? Table2 : Eye;
                return (
                  <li key={key}>
                    <div className="group hover:bg-accent flex items-center rounded-md">
                      <button
                        type="button"
                        onClick={() => {
                          toggle(key);
                        }}
                        aria-expanded={isOpen}
                        className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 text-left"
                      >
                        <ChevronRight
                          className={`size-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        />
                        <Icon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{table.name}</span>
                      </button>
                      {onPick && (
                        <button
                          type="button"
                          onClick={() => {
                            onPick(schema === 'public' ? table.name : key);
                          }}
                          className="text-muted-foreground hover:bg-background mr-1 hidden rounded px-1.5 text-xs group-hover:block"
                        >
                          insert
                        </button>
                      )}
                    </div>
                    {isOpen && (
                      <ul className="ml-7 border-l pl-2">
                        {table.columns.map((col) => (
                          <li key={col.name}>
                            <button
                              type="button"
                              disabled={!onPick}
                              onClick={() => onPick?.(col.name)}
                              className="enabled:hover:bg-accent flex w-full items-baseline justify-between gap-2 rounded px-2 py-0.5 text-left"
                            >
                              <span className="truncate">{col.name}</span>
                              <span className="text-muted-foreground shrink-0 font-mono text-xs">
                                {col.nativeType}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
