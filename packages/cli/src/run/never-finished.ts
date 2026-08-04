/** Nothing left to do, and nothing was ever decided. */
const NOTHING_LEFT = 70;

/**
 * Notice a run that can never finish.
 *
 * `beforeExit` fires exactly when the event loop has drained and there is
 * nothing left to do. Reaching it without a verdict means the work cannot
 * settle, and the process would otherwise leave with 0 and CI would read a
 * pass. `Promise.race([])` was one way in and is now closed, but the shape is
 * general, so what is watched for here is the symptom and not the cause.
 *
 * The runner cannot make this assertion itself: a walk that never returns has
 * no way out to make it on.
 *
 * @param write Where to say it, which is standard error in every command.
 * @returns How to disarm the watch, which the command calls once it reports.
 */
export function watchForAStuckRun(write: (line: string) => void): () => void {
  let reported = false;
  const onIdle = (): void => {
    if (reported) return;
    reported = true;
    write("The run never finished: nothing is left to do and no verdict was reached.\n");
    process.exitCode = NOTHING_LEFT;
  };
  process.on("beforeExit", onIdle);
  return () => {
    reported = true;
    process.off("beforeExit", onIdle);
  };
}
