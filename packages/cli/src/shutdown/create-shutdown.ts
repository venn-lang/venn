import { closeAll } from "@venn-lang/runtime";
import type { Closer, Shutdown } from "./shutdown.types.js";

/**
 * The registry: what to close, and the promise that it happened.
 *
 * Closing runs newest first, because a thing opened later may be standing on one
 * opened earlier. One closer that throws must not strand the rest: leaving is
 * the goal, and a half-closed program still has to go. What failed is handed
 * back rather than swallowed, so a program that could not give something back
 * does not leave saying it did.
 */
export function createShutdown(): Shutdown {
  const closers = new Set<Closer>();
  let closing: Promise<readonly unknown[]> | undefined;
  return {
    add: (closer) => {
      closers.add(closer);
      return () => {
        closers.delete(closer);
      };
    },
    close: () => {
      closing ??= closeEvery(closers);
      return closing;
    },
  };
}

async function closeEvery(closers: Set<Closer>): Promise<readonly unknown[]> {
  const failures = await closeAll([...closers].reverse());
  closers.clear();
  return failures;
}
