/**
 * A source of randomness. Every implementation is reproducible, so a failing
 * run can be replayed.
 */
export interface Random {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in the inclusive range [min, max]. */
  int(min: number, max: number): number;
}
