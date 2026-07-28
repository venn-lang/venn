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
  close(): Promise<void>;
}
