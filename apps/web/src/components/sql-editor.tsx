'use client';

import { PostgreSQL, sql, type SQLNamespace } from '@codemirror/lang-sql';
import { keymap } from '@codemirror/view';
import type { TableInfo } from '@vantage/shared';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { forwardRef, useMemo } from 'react';

function toNamespace(tables: TableInfo[]): SQLNamespace {
  const ns: Record<string, Record<string, string[]>> = {};
  for (const t of tables) {
    const schemaTables = (ns[t.schema] ??= {});
    schemaTables[t.name] = t.columns.map((c) => c.name);
  }
  // Tables in `public` are also suggested without the schema prefix.
  return { ...ns, ...(ns.public ?? {}) };
}

export interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  tables?: TableInfo[] | undefined;
  className?: string;
}

export const SqlEditor = forwardRef<ReactCodeMirrorRef, SqlEditorProps>(function SqlEditor(
  { value, onChange, onRun, tables, className },
  ref,
) {
  const extensions = useMemo(
    () => [
      sql({ dialect: PostgreSQL, schema: toNamespace(tables ?? []), upperCaseKeywords: false }),
      keymap.of([
        {
          key: 'Mod-Enter',
          preventDefault: true,
          run: () => {
            onRun();
            return true;
          },
        },
      ]),
    ],
    [tables, onRun],
  );

  return (
    <CodeMirror
      ref={ref}
      value={value}
      onChange={onChange}
      extensions={extensions}
      height="100%"
      className={className}
      basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
      aria-label="SQL editor"
    />
  );
});
