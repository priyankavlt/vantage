'use client';

import {
  postgresConfigSchema,
  type DataSourceConfig,
  type TestConnectionResult,
} from '@vantage/shared';
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { use, useRef, useState, type SubmitEvent } from 'react';
import { PageHeader } from '@/components/app-shell';
import { ErrorMessage } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { useCreateDataSource, useTestConnection } from '@/hooks/use-data-sources';

function readForm(form: HTMLFormElement): { name: string; config: DataSourceConfig } | string {
  const data = new FormData(form);
  const text = (key: string) => {
    const v = data.get(key);
    return typeof v === 'string' ? v : '';
  };
  const parsed = postgresConfigSchema.safeParse({
    host: text('host'),
    port: text('port') || 5432,
    database: text('database'),
    user: text('user'),
    password: text('password'),
    ssl: text('ssl'),
  });
  if (!parsed.success) return 'Please fill in host, database and user.';
  return { name: text('name').trim(), config: { type: 'postgres', config: parsed.data } };
}

function TestResult({ result }: { result: TestConnectionResult }) {
  return result.ok ? (
    <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 className="size-4" /> Connected · {result.serverVersion} · {result.latencyMs} ms
    </p>
  ) : (
    <p className="text-destructive flex items-center gap-2 text-sm">
      <XCircle className="size-4" /> {result.message}
    </p>
  );
}

export default function NewDataSourcePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const test = useTestConnection(workspaceId);
  const create = useCreateDataSource(workspaceId);

  function onTest() {
    if (!formRef.current) return;
    const values = readForm(formRef.current);
    if (typeof values === 'string') {
      setFormError(values);
      return;
    }
    setFormError(null);
    test.mutate(values.config);
  }

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = readForm(event.currentTarget);
    if (typeof values === 'string' || !values.name) {
      setFormError(typeof values === 'string' ? values : 'Please give the data source a name.');
      return;
    }
    setFormError(null);
    create.mutate(
      { name: values.name, ...values.config },
      {
        onSuccess: (ds) => {
          router.push(`/w/${workspaceId}/data-sources/${ds.id}` as never);
        },
      },
    );
  }

  return (
    <>
      <PageHeader title="Add a Postgres database" />
      <div className="grid gap-8 px-8 py-6 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" name="name" placeholder="Production warehouse" required />
          </div>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="host">Host</Label>
              <Input id="host" name="host" placeholder="db.example.com" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="port">Port</Label>
              <Input id="port" name="port" type="number" defaultValue={5432} min={1} max={65535} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="database">Database</Label>
            <Input id="database" name="database" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="user">User</Label>
              <Input id="user" name="user" autoComplete="off" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ssl">SSL</Label>
            <NativeSelect id="ssl" name="ssl" defaultValue="disable">
              <option value="disable">Disabled</option>
              <option value="require">Required (don&apos;t verify certificate)</option>
              <option value="verify-full">Required and verified</option>
            </NativeSelect>
          </div>
          <ErrorMessage>{formError ?? create.error?.message ?? test.error?.message}</ErrorMessage>
          {test.data && <TestResult result={test.data} />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onTest} disabled={test.isPending}>
              {test.isPending ? 'Testing…' : 'Test connection'}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
        <aside className="bg-muted/30 h-fit rounded-xl border p-5 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <ShieldCheck className="size-4" /> Use a read-only user
          </p>
          <p className="text-muted-foreground mt-2">
            Vantage runs every query in a read-only transaction with a timeout and row limit. For
            extra safety, connect with a user that can only read:
          </p>
          <pre className="bg-background mt-3 overflow-x-auto rounded-md p-3 font-mono text-xs">
            {`create role vantage_reader login password '…';
grant connect on database mydb to vantage_reader;
grant usage on schema public to vantage_reader;
grant select on all tables in schema public
  to vantage_reader;
alter default privileges in schema public
  grant select on tables to vantage_reader;`}
          </pre>
        </aside>
      </div>
    </>
  );
}
