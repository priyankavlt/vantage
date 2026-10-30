import { describe, expect, it, vi } from 'vitest';
import { TtlCache } from './ttl-cache';

describe('TtlCache', () => {
  it('reuses values until they expire', async () => {
    const cache = new TtlCache<number>(1_000);
    const load = vi.fn(() => Promise.resolve(1));
    await cache.get('a', load, 0);
    await cache.get('a', load, 500);
    expect(load).toHaveBeenCalledTimes(1);
    await cache.get('a', load, 1_500);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not cache failures', async () => {
    const cache = new TtlCache<number>(1_000);
    await expect(cache.get('a', () => Promise.reject(new Error('x')), 0)).rejects.toThrow();
    await expect(cache.get('a', () => Promise.resolve(2), 1)).resolves.toBe(2);
  });

  it('deletes by prefix', async () => {
    const cache = new TtlCache<number>(1_000);
    const load = vi.fn(() => Promise.resolve(1));
    await cache.get('t1:a', load, 0);
    cache.delete('t1:');
    await cache.get('t1:a', load, 1);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
