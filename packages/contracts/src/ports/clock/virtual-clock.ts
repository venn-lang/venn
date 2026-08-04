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
    sleep: (ms, signal) => sleep({ ms, signal, advance }),
    advance,
    setTime: (epochMs) => {
      time = epochMs;
    },
  };
}

/**
 * Yields once before advancing, so a signal aborted in the same turn as the
 * call is seen. Advancing first would make a cancelled sleep spend its whole
 * duration here and nowhere else, which is the one thing the real clock does
 * not do.
 */
async function sleep(args: {
  ms: number;
  signal: AbortSignal | undefined;
  advance: (ms: number) => void;
}): Promise<void> {
  await Promise.resolve();
  if (!args.signal?.aborted) args.advance(args.ms);
}
