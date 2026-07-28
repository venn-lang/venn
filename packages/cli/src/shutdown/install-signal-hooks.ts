import { ALL_SIGNALS, type SignalSource, type SystemSignal } from "@venn/contracts";
import type { Leave, Unregister } from "./shutdown.types.js";

/** What the shell means by each signal, in exit codes. */
const CODES: Record<SystemSignal, number> = {
  SIGINT: 130,
  SIGTERM: 143,
  SIGBREAK: 130,
  SIGHUP: 129,
};

/**
 * Every way a system can ask this program to stop, wired to the same ending.
 *
 * `Ctrl+C` is the one everybody knows; `SIGTERM` is how a supervisor or a CI
 * runner asks; `SIGBREAK` is Windows' Ctrl+Break; `SIGHUP` is the terminal
 * closing with the program still inside it. All four deserve the same care.
 */
export function installSignalHooks(args: { signals: SignalSource; leave: Leave }): Unregister {
  const offs = ALL_SIGNALS.map((signal) =>
    args.signals.on(signal, () => args.leave(CODES[signal])),
  );
  return () => {
    for (const off of offs) off();
  };
}
