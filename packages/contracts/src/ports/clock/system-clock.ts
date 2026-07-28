import type { Clock } from "./clock.types.js";

/** Wall-clock time, on the `Date` and `setTimeout` globals. */
export function createSystemClock(): Clock {
  return {
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}
