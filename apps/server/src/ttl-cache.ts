/**
 * Tiny promise cache with a time-to-live. Concurrent callers for the same key
 * share one in-flight promise; failures are not cached.
 */
export class TtlCache<T> {
  readonly #entries = new Map<string, { expires: number; value: Promise<T> }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 1_000,
  ) {}

  get(key: string, load: () => Promise<T>, now = Date.now()): Promise<T> {
    const hit = this.#entries.get(key);
    if (hit && hit.expires > now) return hit.value;

    if (this.#entries.size >= this.maxEntries) {
      for (const [k, v] of this.#entries) if (v.expires <= now) this.#entries.delete(k);
      if (this.#entries.size >= this.maxEntries) this.#entries.clear();
    }
    const value = load();
    this.#entries.set(key, { expires: now + this.ttlMs, value });
    value.catch(() => {
      if (this.#entries.get(key)?.value === value) this.#entries.delete(key);
    });
    return value;
  }

  delete(prefix: string): void {
    for (const key of this.#entries.keys()) if (key.startsWith(prefix)) this.#entries.delete(key);
  }
}
