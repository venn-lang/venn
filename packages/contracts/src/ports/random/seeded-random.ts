import type { Random } from "./random.types.js";

/**
 * The real one: a mulberry32 PRNG, seeded once per worker. Same seed, same
 * sequence, so a run reproduces.
 */
export function createSeededRandom(args: { seed: number }): Random {
  const seed = args.seed >>> 0;
  let state = seed;
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const restart = (): void => {
    state = seed;
  };
  return { next, int: (min, max) => min + Math.floor(next() * (max - min + 1)), restart };
}
