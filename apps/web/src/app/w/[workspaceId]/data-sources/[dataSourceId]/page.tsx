'use client';

import { CheckCircle2, TerminalSquare, XCircle } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { PageHeader } from '@/components/app-shell';
import { SchemaBrowser } from '@/components/schema-browser';
import { ErrorMessage } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  useDataSourceSchema,
  useDataSources,
  useTestSavedConnection,
} from '@/hooks/use-data-sources';

export default function DataSourcePage({
  params,
}: {
  params: Promise<{ workspaceId: string; dataSourceId: string }>;
}) {
  const { workspaceId, dataSourceId } = use(params);
  const { data: sources } = useDataSources(workspaceId);
  const ds = sources?.find((s) => s.id === dataSourceId);
  const schema = useDataSourceSchema(workspaceId, dataSourceId);
  const test = useTestSavedConnection(workspaceId);

  return (
    <>
      <PageHeader
        title={ds?.name ?? 'Data source'}
        description={ds ? `PostgreSQL · ${ds.host} / ${ds.database}` : undefined}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                test.mutate(dataSourceId);
              }}
              disabled={test.isPending}
            >
              {test.isPending ? 'Testing…' : 'Test connection'}
            </Button>
            <Button asChild>
              <Link href={`/w/${workspaceId}/queries/new?dataSource=${dataSourceId}` as never}>
                <TerminalSquare /> New query
              </Link>
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-4 px-8 py-6">
        {test.data &&
          (test.data.ok ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-4" /> Connected · {test.data.serverVersion} ·{' '}
              {test.data.latencyMs} ms
            </p>
          ) : (
            <p className="text-destructive flex items-center gap-2 text-sm">
              <XCircle className="size-4" /> {test.data.message}
            </p>
          ))}
        <ErrorMessage>{schema.error?.message}</ErrorMessage>
        <section className="max-w-xl">
          <h2 className="mb-2 font-medium">
            Schema
            {schema.data && (
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                {schema.data.tables.length} tables and views
              </span>
            )}
          </h2>
          {schema.isPending && <p className="text-muted-foreground text-sm">Reading schema…</p>}
          {schema.data && <SchemaBrowser tables={schema.data.tables} />}
        </section>
      </div>
    </>
  );
}
