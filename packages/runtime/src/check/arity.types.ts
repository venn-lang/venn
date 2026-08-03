/** How many positional arguments something takes: the fewest, and the most. */
export interface Arity {
  least: number;
  /** `Infinity` when the last declared argument takes the rest. */
  most: number;
}
