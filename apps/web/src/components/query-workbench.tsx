'use client';

import type { QueryResult, SavedQuery } from '@vantage/shared';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { BarChart3, Play, Save, Square } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ResultsTable } from '@/components/results-table';
import { SchemaBrowser } from '@/components/schema-browser';
import { SqlEditor } from '@/components/sql-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { useDataSourceSchema, useDataSources } from '@/hooks/use-data-sources';
import { runQuery, useCreateSavedQuery, useUpdateSavedQuery } from '@/hooks/use-queries';
import { ApiRequestError } from '@/lib/api';

interface RunState {
  status: 'idle' | 'running' | 'done' | 'error';
  result?: QueryResult;
  error?: { message: string; line?: number; column?: number };
}

/** Turn a 1-based character offset into a line and column for error messages. */
function locate(sql: string, position: number): { line: number; column: number } {
  const before = sql.slice(0, Math.max(0, position - 1)).split('\n');
  return { line: before.length, column: (before.at(-1)?.length ?? 0) + 1 };
}

function positionOf(error: ApiRequestError): number | undefined {
  const details = error.details as { position?: unknown } | undefined;
  return typeof details?.position === 'number' ? details.position : undefined;
}

export function QueryWorkbench({
  workspaceId,
  saved,
  initialDataSourceId,
}: {
  workspaceId: string;
  saved?: SavedQuery | undefined;
  initialDataSourceId?: string | undefined;
}) {
  const router = useRouter();
  const sources = useDataSources(workspaceId);
  const [pickedDataSourceId, setDataSourceId] = useState(
    saved?.dataSourceId ?? initialDataSourceId ?? '',
  );
  // Fall back to the first data source until the user picks one.
  const dataSourceId =
    pickedDataSourceId !== '' ? pickedDataSourceId : (sources.data?.[0]?.id ?? '');
  const [sql, setSql] = useState(saved?.sql ?? 'select 1;');
  const [name, setName] = useState(saved?.name ?? '');
  const [run, setRun] = useState<RunState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const schema = useDataSourceSchema(workspaceId, dataSourceId || undefined);
  const create = useCreateSavedQuery(workspaceId);
  const update = useUpdateSavedQuery(workspaceId);

  const dirty = saved
    ? saved.sql !== sql || saved.name !== name || saved.dataSourceId !== dataSourceId
    : true;

  const execute = useCallback(async () => {
    if (!dataSourceId || !sql.trim()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRun((prev) => ({ ...prev, status: 'running' }));
    try {
      const result = await runQuery(workspaceId, { dataSourceId, sql }, controller.signal);
      setRun({ status: 'done', result });
    } catch (error) {
      if (controller.signal.aborted) {
        setRun({ status: 'error', error: { message: 'Query cancelled' } });
        return;
      }
      const message = error instanceof Error ? error.message : 'Query failed';
      const position = error instanceof ApiRequestError ? positionOf(error) : undefined;
      setRun({
        status: 'error',
        error: { message, ...(position === undefined ? {} : locate(sql, position)) },
      });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [dataSourceId, sql, workspaceId]);

  const cancel = () => {
    abortRef.current?.abort();
  };

  // Cancel any running query when leaving the page.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function save() {
    const body = {
      name: name.trim() || 'Untitled query',
      sql,
      dataSourceId: dataSourceId || null,
    };
    if (saved) {
      await update.mutateAsync({ id: saved.id, ...body });
    } else {
      const created = await create.mutateAsync(body);
      router.replace(`/w/${workspaceId}/queries/${created.id}` as never);
    }
    setName(body.name);
  }

  const insertAtCursor = (text: string) => {
    const view = editorRef.current?.view;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    view.focus();
  };

  const saveError = create.error ?? update.error;
  const noSources = sources.data?.length === 0;

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-64 shrink-0 flex-col gap-2 border-r p-3 lg:flex">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Schema</p>
        {schema.isPending && dataSourceId && (
          <p className="text-muted-foreground text-sm">Loading…</p>
        )}
        {schema.error && <p className="text-destructive text-sm">{schema.error.message}</p>}
        {schema.data && <SchemaBrowser tables={schema.data.tables} onPick={insertAtCursor} />}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            placeholder="Untitled query"
            aria-label="Query name"
            className="hover:border-input focus-visible:border-ring h-8 w-64 border-transparent shadow-none"
          />
          <NativeSelect
            value={dataSourceId}
            onChange={(e) => {
              setDataSourceId(e.target.value);
            }}
            aria-label="Data source"
            className="h-8 w-56"
          >
            {noSources && <option value="">No data sources</option>}
            {sources.data?.map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.name}
              </option>
            ))}
          </NativeSelect>
          <div className="ml-auto flex items-center gap-2">
            {saved && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/w/${workspaceId}/charts/new?query=${saved.id}` as never}>
                  <BarChart3 /> Visualize
                </Link>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void save()}
              disabled={!dirty || create.isPending || update.isPending}
            >
              <Save /> {saved ? (dirty ? 'Save' : 'Saved') : 'Save'}
            </Button>
            {run.status === 'running' ? (
              <Button size="sm" variant="secondary" onClick={cancel}>
                <Square /> Cancel
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => void execute()}
                disabled={!dataSourceId}
                title="Run (⌘/Ctrl + Enter)"
              >
                <Play /> Run
              </Button>
            )}
          </div>
        </div>

        {noSources && (
          <p className="bg-muted/40 border-b px-4 py-2 text-sm">
            Add a data source first.{' '}
            <Link
              className="font-medium underline"
              href={`/w/${workspaceId}/data-sources/new` as never}
            >
              Connect a database
            </Link>
          </p>
        )}
        {saveError && (
          <p role="alert" className="text-destructive border-b px-4 py-2 text-sm">
            {saveError.message}
          </p>
        )}

        <div className="h-[40%] min-h-40 overflow-hidden border-b">
          <SqlEditor
            ref={editorRef}
            value={sql}
            onChange={setSql}
            onRun={() => void execute()}
            tables={schema.data?.tables}
            className="h-full text-sm"
          />
        </div>

        <div className="text-muted-foreground flex items-center gap-3 border-b px-4 py-1.5 text-xs">
          {run.status === 'idle' && <span>Press ⌘/Ctrl + Enter to run</span>}
          {run.status === 'running' && <span>Running…</span>}
          {run.result && run.status !== 'running' && (
            <>
              <span>
                {run.result.rowCount.toLocaleString()} row{run.result.rowCount === 1 ? '' : 's'}
              </span>
              <span>{run.result.durationMs.toLocaleString()} ms</span>
              {run.result.truncated && (
                <span className="text-amber-700 dark:text-amber-400">
                  Showing the first {run.result.rowCount.toLocaleString()} rows (limit reached)
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {run.status === 'error' && run.error && (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/10 m-4 rounded-md border p-3 text-sm"
            >
              <p className="text-destructive font-medium">{run.error.message}</p>
              {run.error.line !== undefined && (
                <p className="text-muted-foreground mt-1">
                  Line {run.error.line}, column {run.error.column}
                </p>
              )}
            </div>
          )}
          {run.result && run.status !== 'error' && (
            <ResultsTable
              result={run.result}
              className={run.status === 'running' ? 'flex-1 opacity-50' : 'flex-1'}
            />
          )}
        </div>
      </div>
    </div>
  );
}
