import type { SignalSource } from "@venn/contracts";
import { createLeave } from "./create-leave.js";
import { installExitHook } from "./install-exit-hook.js";
import { installFaultHooks } from "./install-fault-hooks.js";
import { installSignalHooks } from "./install-signal-hooks.js";
import type { Leave, Shutdown } from "./shutdown.types.js";

/** Everything the process-level hooks need from the outside world. */
export interface HooksArgs {
  signals: SignalSource;
  shutdown: Shutdown;
  /** How the program leaves. Injected so a test can watch instead of dying. */
  exit: (code: number) => void;
  /** Where a fault is announced. Defaults to stderr. */
  report?: (message: string) => void;
  graceMs?: number;
}

/**
 * Hand the process its hooks. The three ways a program can end (asked to stop,
 * broken, or simply finished) all end the same way.
 *
 * Returns the `leave` these hooks share, so a command that decides to stop on
 * its own terms unwinds through exactly the same path.
 */
export function installHooks(args: HooksArgs): Leave {
  const leave = createLeave({
    shutdown: args.shutdown,
    exit: args.exit,
    graceMs: args.graceMs,
  });
  installSignalHooks({ signals: args.signals, leave });
  installFaultHooks({ leave, report: args.report });
  installExitHook(args.shutdown);
  return leave;
}
