const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;

// shortcut: contadores en memoria de este proceso; pasarlos a la base si la web corre en varias instancias.
export class LoginThrottle {
  private readonly failures = new Map<string, { count: number; firstAt: number }>();

  isBlocked(key: string, now: Date): boolean {
    const entry = this.failures.get(key);
    if (!entry) return false;
    if (now.getTime() - entry.firstAt >= WINDOW_MS) {
      this.failures.delete(key);
      return false;
    }
    return entry.count >= MAX_FAILURES;
  }

  recordFailure(key: string, now: Date): void {
    for (const [k, entry] of this.failures) {
      if (now.getTime() - entry.firstAt >= WINDOW_MS) this.failures.delete(k);
    }
    const entry = this.failures.get(key);
    if (entry) entry.count += 1;
    else this.failures.set(key, { count: 1, firstAt: now.getTime() });
  }

  reset(key: string): void {
    this.failures.delete(key);
  }

  get size(): number {
    return this.failures.size;
  }
}
