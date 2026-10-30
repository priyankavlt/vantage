'use client';

import { LayoutDashboard, Link2, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState, type SubmitEvent } from 'react';
import { PageHeader } from '@/components/app-shell';
import { ErrorMessage } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { useCreateDashboard, useDashboards, useDeleteDashboard } from '@/hooks/use-dashboards';

export default function DashboardsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const router = useRouter();
  const { data, isPending, error } = useDashboards(workspaceId);
  const create = useCreateDashboard(workspaceId);
  const remove = useDeleteDashboard(workspaceId);
  const [name, setName] = useState('');
  const base = `/w/${workspaceId}/dashboards`;

  function onCreate(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate(trimmed, {
      onSuccess: (d) => {
        router.push(`${base}/${d.id}?edit=1` as never);
      },
    });
  }

  const form = (
    <form onSubmit={onCreate} className="flex gap-2">
      <Input
        value={name}
        onChange={(e) => {
          setName(e.target.value);
        }}
        placeholder="New dashboard name"
        aria-label="New dashboard name"
        className="w-56"
      />
      <Button type="submit" disabled={create.isPending || !name.trim()}>
        <Plus /> Create
      </Button>
    </form>
  );

  return (
    <>
      <PageHeader title="Dashboards" description="Arrange charts and share them." actions={form} />
      <div className="flex flex-col gap-4 px-8 py-6">
        <ErrorMessage>
          {error?.message ?? create.error?.message ?? remove.error?.message}
        </ErrorMessage>
        {isPending && <p className="text-muted-foreground text-sm">Loading…</p>}
        {data?.length === 0 && (
          <EmptyState
            icon={<LayoutDashboard className="size-8" />}
            title="No dashboards yet"
            description="Name a dashboard above, then add your saved charts to it."
          />
        )}
        {data && data.length > 0 && (
          <ul className="divide-y rounded-xl border">
            {data.map((d) => (
              <li key={d.id} className="flex items-center gap-4 px-5 py-3">
                <Link href={`${base}/${d.id}` as never} className="min-w-0 flex-1">
                  <p className="font-medium hover:underline">{d.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {d.items.length} chart{d.items.length === 1 ? '' : 's'}
                  </p>
                </Link>
                {d.shareToken && (
                  <span className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Link2 className="size-3.5" /> Shared
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${d.name}`}
                  onClick={() => {
                    if (window.confirm(`Delete "${d.name}"?`)) remove.mutate(d.id);
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
