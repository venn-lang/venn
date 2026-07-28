import { mulberry32 } from "./mulberry32.js";
import type { Rng } from "./rng.types.js";

/** The fixed seed. A constant seed is what makes every generated value reproducible. */
const SEED = 1;

let shared: Rng = mulberry32(SEED);

/** The module-level deterministic PRNG shared by every generator in this package. */
export const rng: Rng = () => shared();

/** Reset the shared PRNG to its seed so the same stream can be drawn again. Used by tests. */
export function resetRng(): void {
  shared = mulberry32(SEED);
}
