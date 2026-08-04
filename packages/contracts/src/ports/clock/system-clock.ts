import type { Clock } from "./clock.types.js";

/** Wall-clock time, on the `Date` and `setTimeout` globals. */
export function createSystemClock(): Clock {
  return { now: () => Date.now(), sleep };
}

/**
 * The timer is cleared on the way out rather than left to fire.
 *
 * A scheduled `setTimeout` keeps Node's event loop alive, so a run that has
 * already reported its verdict would sit here for the remainder of the very
 * sleep it just cancelled. Clearing it is the difference between a cancelled
 * wait and a process that cannot leave.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener("abort", done, { once: true });
  });
}
