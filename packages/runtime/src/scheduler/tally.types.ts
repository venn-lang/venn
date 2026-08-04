/**
 * Failures counted for one frame, and for every frame that frame runs inside.
 *
 * A verdict is a question about one frame: did this step fail, did this flow.
 * The run's own counter cannot answer it, because it is one number shared by
 * reference with every branch of a `parallel`, so a step that passed read a
 * sibling's failure as its own and a `@retry` re-ran work that never failed.
 */
export interface Tally {
  /** Failures reported in this frame, or anywhere below it. */
  count: number;
  /** The frame this one runs inside, which counts whatever this one counts. */
  parent?: Tally;
}
