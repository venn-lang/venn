/**
 * Where a number arrived and what that position can use.
 *
 * Carried into the reader rather than read back out of it, because the sentence
 * a refusal prints has to name the verb the reader wrote and the range that
 * verb accepts, and neither is recoverable from the number alone.
 */
export interface Counted {
  /** The member as it is written: `take`, `chunk`, `padStart`. */
  readonly verb: string;
  /** What the position holds, as a bare noun: `count`, `chunk size`, `width`. */
  readonly what: string;
  /** The smallest value it accepts, where the position has a floor: 1 for a size. */
  readonly least?: number;
  /** The largest it accepts, where it has a ceiling: 20 decimal places. */
  readonly most?: number;
}
