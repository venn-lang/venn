import { constants } from "node:os";
import process from "node:process";
import type { SignalSource, SystemSignal, Unsubscribe } from "./signal-source.types.js";

/**
 * Whether this platform knows the signal.
 *
 * Not every name exists everywhere: `SIGBREAK` is Windows only, and subscribing
 * to an unknown one throws. Asking first turns a crash at start up into a
 * subscription that never fires.
 */
export function isKnownSignal(signal: SystemSignal): boolean {
  return signal in constants.signals;
}

/**
 * The real one: the signals this process receives.
 *
 * Lives behind `@venn/contracts/node` because it touches `node:process`, so the
 * main entry stays neutral and still runs in the editor's worker.
 */
export function createNodeSignals(): SignalSource {
  return {
    on: (signal, handler): Unsubscribe => {
      if (!isKnownSignal(signal)) return () => {};
      const listener = () => handler(signal);
      process.on(signal, listener);
      return () => {
        process.off(signal, listener);
      };
    },
  };
}
