'use client';

import { Database, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { PageHeader } from '@/components/app-shell';
import { ErrorMessage } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useDataSources, useDeleteDataSource } from '@/hooks/use-data-sources';

export default function DataSourcesPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const { data, isPending, error } = useDataSources(workspaceId);
  const remove = useDeleteDataSource(workspaceId);
  const base = `/w/${workspaceId}/data-sources`;

  const addButton = (
    <Button asChild>
      <Link href={`${base}/new` as never}>
        <Plus /> Add data source
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Data sources"
        description="Databases Vantage can query. Credentials are encrypted at rest."
        actions={data && data.length > 0 ? addButton : undefined}
      />
      <div className="flex flex-col gap-4 px-8 py-6">
        <ErrorMessage>{error?.message ?? remove.error?.message}</ErrorMessage>
        {isPending && <p className="text-muted-foreground text-sm">Loading…</p>}
        {data?.length === 0 && (
          <EmptyState
            icon={<Database className="size-8" />}
            title="No data sources yet"
            description="Connect a Postgres database to start writing queries."
            action={addButton}
          />
        )}
        {data && data.length > 0 && (
          <ul className="divide-y rounded-xl border">
            {data.map((ds) => (
              <li key={ds.id} className="flex items-center gap-4 px-5 py-4">
                <Database className="text-muted-foreground size-5" aria-hidden />
                <Link href={`${base}/${ds.id}` as never} className="min-w-0 flex-1">
                  <p className="font-medium hover:underline">{ds.name}</p>
                  <p className="text-muted-foreground truncate text-sm">
                    PostgreSQL · {ds.host} / {ds.database}
                  </p>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${ds.name}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete "${ds.name}"? Saved queries using it will stop working.`,
                      )
                    ) {
                      remove.mutate(ds.id);
                    }
                  }}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
