import type { UnwindArgs } from "./cancel.types.js";

/**
 * How long a cancelled scope waits for what it cancelled to actually stop.
 *
 * Everything that honours the signal, which is every `wait` and every action
 * that reads `ctx.signal`, unwinds within a turn or two. The grace is for what
 * does not: waiting for that forever would make cancellation the hang it exists
 * to prevent.
 */
export const GRACE_MS = 2000;

/**
 * Wait for cancelled work to finish unwinding, but never longer than the grace.
 *
 * The grace is a plain timer, deliberately not the run's clock: this is the one
 * wait a program must not be able to cancel, stretch or freeze, because it is
 * what stands between a body that ignores its signal and a run that never ends.
 *
 * @param args What was cancelled, and how long to wait for it.
 * @returns Whether everything stopped. `false` means work was left running, and
 * the caller has to say so rather than report a verdict over it.
 */
export async function unwind(args: UnwindArgs): Promise<boolean> {
  if (args.work.length === 0) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const gaveUp = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), args.graceMs ?? GRACE_MS);
  });
  const settled = Promise.allSettled(args.work).then(() => true);
  try {
    return await Promise.race([settled, gaveUp]);
  } finally {
    clearTimeout(timer);
  }
}
