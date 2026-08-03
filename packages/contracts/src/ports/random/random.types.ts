/**
 * A source of randomness. Every implementation is reproducible, so a failing
 * run can be replayed.
 */
export interface Random {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in the inclusive range [min, max]. */
  int(min: number, max: number): number;
  /**
   * Start the stream again where it began.
   *
   * Reproducibility is not a property of the seed on its own: a stream shared
   * by two flows hands the second one whatever the first left, so the same flow
   * answers differently depending on what ran before it. The runner gives the
   * stream back at the start of every flow, and this is how.
   */
  restart(): void;
}
