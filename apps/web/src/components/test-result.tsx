import type { TestConnectionResult } from '@vantage/shared';
import { CheckCircle2, TriangleAlert, XCircle } from 'lucide-react';

/** Result of "Test connection", including least-privilege warnings. */
export function TestResult({ result }: { result: TestConnectionResult }) {
  return result.ok ? (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-4" /> Connected · {result.serverVersion} · {result.latencyMs}{' '}
        ms
      </p>
      {result.warnings?.map((w) => (
        <p
          key={w}
          role="alert"
          className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {w}
        </p>
      ))}
    </div>
  ) : (
    <p className="text-destructive flex items-center gap-2 text-sm">
      <XCircle className="size-4" /> {result.message}
    </p>
  );
}
