import type { Rng } from "./rng.types.js";

/**
 * Mulberry32: a tiny, fast, fully deterministic PRNG.
 *
 * @param seed Any number. It is coerced to a uint32, so the same seed always
 * yields the same stream.
 * @returns A generator producing the next float in [0, 1) on each call.
 */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
