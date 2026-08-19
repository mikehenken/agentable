/**
 * Deterministic PRNG for seeded eval adapters.
 * Mulberry32 — fast, reproducible 32-bit generator.
 */
export interface SeededRandom {
  (): number;
  seed: number;
  int(min: number, max: number): number;
}

export function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;

  const rng = ((): number => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as SeededRandom;

  rng.seed = seed;
  rng.int = (min: number, max: number): number => {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
      throw new Error('createSeededRandom.int: invalid min/max');
    }
    const span = max - min + 1;
    return min + Math.floor(rng() * span);
  };

  return rng;
}
