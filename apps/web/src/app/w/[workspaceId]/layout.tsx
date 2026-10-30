import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { Providers } from '@/components/providers';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return (
    <Providers>
      <AppShell workspaceId={workspaceId}>{children}</AppShell>
    </Providers>
  );
}
