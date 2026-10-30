'use client';

import { workspaceSchema } from '@vantage/shared';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Database, LayoutDashboard, TerminalSquare } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { PageHeader } from '@/components/app-shell';
import { ErrorMessage } from '@/components/ui/alert';
import { api } from '@/lib/api';

const STEPS = [
  {
    href: '/data-sources',
    icon: Database,
    title: 'Connect a database',
    body: 'Add a Postgres connection.',
  },
  {
    href: '/queries',
    icon: TerminalSquare,
    title: 'Write a query',
    body: 'Explore your data with SQL.',
  },
  {
    href: '/charts',
    icon: BarChart3,
    title: 'Build a chart',
    body: 'Turn query results into visuals.',
  },
  {
    href: '/dashboards',
    icon: LayoutDashboard,
    title: 'Make a dashboard',
    body: 'Arrange charts and share them.',
  },
] as const;

export default function WorkspaceHome({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const { data, error } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => api(`/workspaces/${workspaceId}`, workspaceSchema),
  });

  return (
    <>
      <PageHeader title={data?.name ?? 'Workspace'} description="Get started in four steps." />
      <div className="px-8 py-6">
        <ErrorMessage>{error?.message}</ErrorMessage>
        <ol className="grid gap-4 sm:grid-cols-2">
          {STEPS.map(({ href, icon: Icon, title, body }, i) => (
            <li key={href}>
              <Link
                href={`/w/${workspaceId}${href}` as never}
                className="hover:bg-accent/50 flex h-full gap-4 rounded-xl border p-5 transition-colors"
              >
                <Icon className="text-muted-foreground mt-0.5 size-5" aria-hidden />
                <div>
                  <p className="font-medium">
                    {i + 1}. {title}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">{body}</p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
