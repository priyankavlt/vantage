'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { authClient } from '@/lib/auth-client';

/** Landing after sign-in: open the active workspace, or the first one. */
export default function AppRedirectPage() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { data: workspaces, isPending } = authClient.useListOrganizations();

  useEffect(() => {
    if (sessionPending || isPending) return;
    if (!session) {
      router.replace('/sign-in');
      return;
    }
    const activeId = session.session.activeOrganizationId;
    const target = workspaces?.find((w) => w.id === activeId) ?? workspaces?.[0];
    if (target) router.replace(`/w/${target.id}`);
  }, [router, session, sessionPending, workspaces, isPending]);

  return (
    <main className="text-muted-foreground flex min-h-dvh items-center justify-center text-sm">
      Loading your workspace…
    </main>
  );
}
