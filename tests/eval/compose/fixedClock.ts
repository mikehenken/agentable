/**
 * Fixed clock for deterministic compose eval runs.
 */
export interface FixedClock {
  readonly iso: string;
  now: Date;
  nowIso: string;
  advance(ms: number): void;
  elapsedMs: number;
}

export function createFixedClock(iso: string): FixedClock {
  let currentMs = Date.parse(iso);
  if (Number.isNaN(currentMs)) {
    throw new Error(`createFixedClock: invalid ISO timestamp "${iso}"`);
  }
  const startMs = currentMs;

  return {
    iso,
    // Getters, not methods: the FixedClock interface exposes these as
    // properties and consumers (harness fingerprinting) read them directly.
    get now(): Date {
      return new Date(currentMs);
    },
    get nowIso(): string {
      return new Date(currentMs).toISOString();
    },
    advance(ms: number): void {
      if (!Number.isFinite(ms) || ms < 0) {
        throw new Error(`createFixedClock.advance: ms must be a non-negative finite number`);
      }
      currentMs += ms;
    },
    get elapsedMs(): number {
      return currentMs - startMs;
    },
  };
}
