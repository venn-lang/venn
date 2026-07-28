/** Now, sleeping, deadlines. */
export interface Clock {
  /** Milliseconds since the epoch, or since the virtual clock's start. */
  now(): number;
  sleep(ms: number): Promise<void>;
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
