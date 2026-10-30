'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type SubmitEvent } from 'react';
import { ErrorMessage } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn, signUp } from '@/lib/auth-client';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isSignUp = mode === 'sign-up';

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const field = (name: string) => {
      const value = form.get(name);
      return typeof value === 'string' ? value : '';
    };
    const email = field('email');
    const password = field('password');
    setPending(true);
    setError(null);
    const result = isSignUp
      ? await signUp.email({ email, password, name: field('name') })
      : await signIn.email({ email, password });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? 'Something went wrong');
      return;
    }
    router.replace('/app');
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </CardTitle>
        <CardDescription>
          {isSignUp ? 'Start exploring your data in minutes.' : 'Sign in to your Vantage account.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
          {isSignUp && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" autoComplete="name" required />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
            />
          </div>
          <ErrorMessage>{error}</ErrorMessage>
          <Button type="submit" disabled={pending}>
            {pending ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            {isSignUp ? 'Already have an account? ' : 'New to Vantage? '}
            <Link
              href={isSignUp ? '/sign-in' : '/sign-up'}
              className="text-foreground font-medium underline-offset-4 hover:underline"
            >
              {isSignUp ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
