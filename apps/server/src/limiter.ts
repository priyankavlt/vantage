/** Caps how many queries run at once per key (workspace), so one tenant can't exhaust pools. */
export class ConcurrencyLimiter {
  readonly #running = new Map<string, number>();

  constructor(private readonly max: number) {}

  /** Returns a release function, or null when the key is at its limit. */
  tryAcquire(key: string): (() => void) | null {
    const current = this.#running.get(key) ?? 0;
    if (current >= this.max) return null;
    this.#running.set(key, current + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const n = (this.#running.get(key) ?? 1) - 1;
      if (n <= 0) this.#running.delete(key);
      else this.#running.set(key, n);
    };
  }
}
