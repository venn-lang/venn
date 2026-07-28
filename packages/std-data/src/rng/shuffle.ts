import type { Rng } from "./rng.types.js";

/**
 * Fisher-Yates shuffle driven by the given PRNG.
 *
 * @returns A new array holding the same elements in a new order. `items` is untouched.
 */
export function shuffleWith(items: readonly unknown[], rng: Rng): unknown[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
