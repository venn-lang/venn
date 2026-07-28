/**
 * How a program ended, and what the process should do about it.
 *
 * Two separate questions. `exit 0` and "ran off the end cleanly" both arrive as
 * the number 0, but one is a request to leave and the other is a program with
 * nothing more to say, which for a server means it is still working.
 */
export interface Ending {
  /** The number to leave with. */
  code: number;
  /**
   * Whether the process should go now. False means hand the decision to the
   * event loop: a program still holding a socket keeps serving, and one holding
   * nothing exits on its own, running its cleanup on the way.
   */
  leave: boolean;
}
