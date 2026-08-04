/** Now, sleeping, deadlines. */
export interface Clock {
  /** Milliseconds since the epoch, or since the virtual clock's start. */
  now(): number;
  /**
   * Wait `ms`, or until `signal` is aborted, whichever comes first.
   *
   * A cancelled sleep resolves rather than rejecting: what the caller wants back
   * is the statement boundary it was heading for, and a rejection here would
   * read as a failure to a `try` written around the wait. An implementation that
   * holds a timer has to drop it, since a timer still scheduled keeps the process
   * alive long after the run that asked for it reported.
   */
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

/**
 * A {@link Clock} whose flow of time a test controls.
 *
 * `advance` and `setTime` sit outside the negotiated contract, so code holding
 * a `Clock` can never reach them.
 */
export interface VirtualClock extends Clock {
  advance(ms: number): void;
  setTime(epochMs: number): void;
}
