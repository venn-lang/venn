/** Something the program opened that has to be given back before it leaves. */
export type Closer = () => Promise<void> | void;

/** Drops a registration, for work whose lifetime is shorter than the process. */
export type Unregister = () => void;

/**
 * The list of things this process still owes the machine.
 *
 * Whoever opens something registers how to close it; whoever is leaving calls
 * `close` once and everything unwinds, newest first.
 */
export interface Shutdown {
  add(closer: Closer): Unregister;
  /**
   * Close everything. Runs once; later callers await the same pass.
   *
   * @returns What each failing closer threw. A program still holding something
   * it meant to hand back has not ended cleanly, and the command that is leaving
   * is the only one left who can say so.
   */
  close(): Promise<readonly unknown[]>;
}

/** How the program leaves, once there is nothing left to give back. */
export type Leave = (code: number) => void;
