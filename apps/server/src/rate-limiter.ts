/** Fixed-window request counter per key (e.g. per public share link). In-memory, single process. */
export class RateLimiter {
  readonly #windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** True if the request is allowed. */
  hit(key: string, now = Date.now()): boolean {
    const w = this.#windows.get(key);
    if (!w || now - w.start >= this.windowMs) {
      if (this.#windows.size > 10_000) this.#windows.clear();
      this.#windows.set(key, { start: now, count: 1 });
      return true;
    }
    w.count += 1;
    return w.count <= this.max;
  }
}
