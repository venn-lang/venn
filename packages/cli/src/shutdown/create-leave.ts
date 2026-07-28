import type { Leave, Shutdown } from "./shutdown.types.js";

/** How long a close may take before the program stops waiting for it. */
const GRACE_MS = 5_000;

/**
 * Leaving, done properly: close what is open, then go.
 *
 * Two things make this more than `await close(); exit()`. A second signal means
 * the user is done asking nicely, so it leaves at once. And a closer that never
 * settles must not hold the program hostage, so the wait has a deadline: an
 * unclean exit beats a process that cannot be stopped.
 */
export function createLeave(args: {
  shutdown: Shutdown;
  exit: (code: number) => void;
  graceMs?: number;
}): Leave {
  let leaving = false;
  return (code) => {
    if (leaving) return args.exit(code);
    leaving = true;
    void finish({ ...args, code });
  };
}

async function finish(args: {
  shutdown: Shutdown;
  exit: (code: number) => void;
  graceMs?: number;
  code: number;
}): Promise<void> {
  await Promise.race([args.shutdown.close(), deadline(args.graceMs ?? GRACE_MS)]);
  args.exit(args.code);
}

/** A timer that does not itself keep the program alive. */
function deadline(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms).unref();
  });
}
