import type { VirtualClock } from "./clock.types.js";

/**
 * The double. `sleep` advances internal time and resolves at once, so a test
 * about a timeout costs nothing to run.
 *
 * @param args.start - the epoch this clock begins at. Defaults to 0.
 */
export function createVirtualClock(args: { start?: number } = {}): VirtualClock {
  let time = args.start ?? 0;
  const advance = (ms: number): void => {
    time += Math.max(0, ms);
  };
  return {
    now: () => time,
    sleep: async (ms) => advance(ms),
    advance,
    setTime: (epochMs) => {
      time = epochMs;
    },
  };
}
