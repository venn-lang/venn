/** Something a run opened, and how to give it back. */
export type Cleanup = () => Promise<void>;

/**
 * Where a run registers what it opened, for whoever owns the process.
 *
 * The runtime does not decide when a program ends: a served program ends when
 * the machine says so, and only the host hears that. So the run says what has to
 * happen on the way out, and the host says when.
 */
export interface CleanupSink {
  add(cleanup: Cleanup): unknown;
}

/** A sink that also runs what it collected, newest first. */
export interface CleanupList extends CleanupSink {
  /**
   * Close everything, whatever any of them does.
   *
   * @returns What each failing cleanup threw. A program still holding something
   * it meant to give back has not ended cleanly, and only the host can say what
   * that is worth.
   */
  close(): Promise<readonly unknown[]>;
}
