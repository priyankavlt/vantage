/**
 * Tiny promise cache with a time-to-live. Concurrent callers for the same key
 * share one in-flight promise. Failures are kept for `failureTtlMs` (0 = not cached),
 * so a failing or slow query can't be retried in a tight loop.
 */
export class TtlCache<T> {
  readonly #entries = new Map<string, { expires: number; value: Promise<T> }>();

  constructor(
    private readonly ttlMs: number,
    private readonly options: { maxEntries?: number; failureTtlMs?: number } = {},
  ) {}

  get(key: string, load: () => Promise<T>, now = Date.now()): Promise<T> {
    const hit = this.#entries.get(key);
    if (hit && hit.expires > now) return hit.value;

    const maxEntries = this.options.maxEntries ?? 1_000;
    if (this.#entries.size >= maxEntries) {
      for (const [k, v] of this.#entries) if (v.expires <= now) this.#entries.delete(k);
      if (this.#entries.size >= maxEntries) this.#entries.clear();
    }
    const value = load();
    const entry = { expires: now + this.ttlMs, value };
    this.#entries.set(key, entry);
    value.catch(() => {
      if (this.#entries.get(key) !== entry) return;
      const failureTtl = this.options.failureTtlMs ?? 0;
      if (failureTtl > 0) entry.expires = Date.now() + failureTtl;
      else this.#entries.delete(key);
    });
    return value;
  }

  delete(prefix: string): void {
    for (const key of this.#entries.keys()) if (key.startsWith(prefix)) this.#entries.delete(key);
  }
}
