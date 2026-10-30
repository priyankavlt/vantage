import { describe, expect, it } from 'vitest';
import { ConcurrencyLimiter } from './limiter';

describe('ConcurrencyLimiter', () => {
  it('limits per key and frees slots on release', () => {
    const limiter = new ConcurrencyLimiter(2);
    const a = limiter.tryAcquire('ws');
    const b = limiter.tryAcquire('ws');
    expect(limiter.tryAcquire('ws')).toBeNull();
    expect(limiter.tryAcquire('other')).not.toBeNull();
    a?.();
    a?.(); // releasing twice is a no-op
    expect(limiter.tryAcquire('ws')).not.toBeNull();
    b?.();
  });
});
