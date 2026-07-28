import type { Random } from "./random.types.js";

/** The double: always the same value, and always `min` from `int`. */
export function createFixedRandom(args: { value?: number } = {}): Random {
  const value = args.value ?? 0;
  return {
    next: () => value,
    int: (min) => min,
  };
}
