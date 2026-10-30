import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <div className="flex items-center gap-2 text-lg font-semibold">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static svg */}
        <img src="/icon.svg" alt="" width={28} height={28} />
        Vantage
      </div>
      {children}
    </main>
  );
}
