import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function ErrorMessage({ className, children, ...props }: ComponentProps<'p'>) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className={cn(
        'border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm',
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}
