import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Vantage</h1>
      <p className="text-muted-foreground text-lg">
        Connect your data, write queries, build charts, and share dashboards.
      </p>
      <div>
        <Button asChild>
          <a href="https://github.com/priyankavlt/vantage">View on GitHub</a>
        </Button>
      </div>
    </main>
  );
}
