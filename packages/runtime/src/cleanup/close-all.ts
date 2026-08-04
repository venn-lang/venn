/**
 * Run every cleanup, in order, whatever any of them does.
 *
 * The one policy this repository has for giving things back, and the one all
 * four runners go through: a `defer`, a `teardown`, a script's cleanup list and
 * the CLI's shutdown. Cleanup is the code that must run on every path, so one
 * entry that throws may not strand the ones behind it: what they still hold is
 * exactly what the program is trying to hand back. One flaky `close` used to
 * leave every earlier resource open.
 *
 * What failed is returned rather than swallowed here, because only the caller
 * knows whether there is anyone left to tell and what a failure means for the
 * verdict.
 *
 * @param cleanups What to run, already in the order it should run in.
 * @returns What each failing entry threw, in the order they failed. Empty when
 * everything gave way cleanly.
 */
export async function closeAll(cleanups: Iterable<() => unknown>): Promise<readonly unknown[]> {
  const failures: unknown[] = [];
  for (const cleanup of cleanups) {
    try {
      await cleanup();
    } catch (error) {
      failures.push(error);
    }
  }
  return failures;
}
