import type { Closer, Shutdown } from "./shutdown.types.js";

/**
 * The registry: what to close, and the promise that it happened.
 *
 * Closing runs newest first, because a thing opened later may be standing on one
 * opened earlier. One closer that throws must not strand the rest: leaving is
 * the goal, and a half-closed program still has to go.
 */
export function createShutdown(): Shutdown {
  const closers = new Set<Closer>();
  let closing: Promise<void> | undefined;
  return {
    add: (closer) => {
      closers.add(closer);
      return () => {
        closers.delete(closer);
      };
    },
    close: () => {
      closing ??= closeAll(closers);
      return closing;
    },
  };
}

async function closeAll(closers: Set<Closer>): Promise<void> {
  for (const closer of [...closers].reverse()) {
    await Promise.resolve()
      .then(() => closer())
      .catch(() => {});
  }
  closers.clear();
}
