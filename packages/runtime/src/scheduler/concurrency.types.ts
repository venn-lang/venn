/** What running a list of work with a limit on how much is in flight needs. */
export interface Pool<T> {
  readonly items: readonly T[];
  /** How many at once. Below one is one: nothing at all would never finish. */
  readonly limit: number;
  readonly task: (item: T, index: number) => Promise<void>;
  /**
   * Whether to stop handing work out.
   *
   * Asked before each item rather than after, so a `break` in one pass ends the
   * loop instead of ending only the pass that wrote it. Both callers ask their
   * cancellation scope here as well, which is what stops a pool dispatching
   * once the run around it has already been decided.
   */
  readonly stop?: () => boolean;
}
