'use client';

import { BarChart3, Database, Home, LayoutDashboard, LogOut, TerminalSquare } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { authClient, signOut } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '', label: 'Home', icon: Home },
  { href: '/data-sources', label: 'Data sources', icon: Database },
  { href: '/queries', label: 'SQL editor', icon: TerminalSquare },
  { href: '/charts', label: 'Charts', icon: BarChart3 },
  { href: '/dashboards', label: 'Dashboards', icon: LayoutDashboard },
] as const;

export function AppShell({ workspaceId, children }: { workspaceId: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: workspaces } = authClient.useListOrganizations();
  const base = `/w/${workspaceId}`;

  async function switchWorkspace(id: string) {
    await authClient.organization.setActive({ organizationId: id });
    router.push(`/w/${id}`);
  }

  return (
    <div className="flex min-h-dvh">
      <aside className="bg-muted/30 flex w-60 shrink-0 flex-col border-r">
        <div className="flex items-center gap-2 px-4 py-4 font-semibold">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny static svg */}
          <img src="/icon.svg" alt="" width={22} height={22} />
          Vantage
        </div>
        <div className="px-3 pb-3">
          <label htmlFor="workspace" className="sr-only">
            Workspace
          </label>
          <select
            id="workspace"
            value={workspaceId}
            onChange={(e) => void switchWorkspace(e.target.value)}
            className="bg-background h-8 w-full rounded-md border px-2 text-sm"
          >
            {(workspaces ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-2" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon }) => {
            const to = `${base}${href}`;
            const active = href === '' ? pathname === base : pathname.startsWith(to);
            return (
              <Link
                key={label}
                // typedRoutes cannot see dynamic template strings; the paths above are real routes.
                href={to as never}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                  active && 'bg-accent text-accent-foreground font-medium',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm">
          <span className="truncate" title={session?.user.email}>
            {session?.user.name}
          </span>
          <button
            type="button"
            onClick={() => {
              void signOut().then(() => {
                router.replace('/sign-in');
              });
            }}
            className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md p-1.5"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b px-8 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
