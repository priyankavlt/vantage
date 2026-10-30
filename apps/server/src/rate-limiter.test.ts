import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  it('allows up to max per window, per key', () => {
    const rl = new RateLimiter(2, 1_000);
    expect(rl.hit('a', 0)).toBe(true);
    expect(rl.hit('a', 10)).toBe(true);
    expect(rl.hit('a', 20)).toBe(false);
    expect(rl.hit('b', 20)).toBe(true);
    expect(rl.hit('a', 1_000)).toBe(true);
  });
});
