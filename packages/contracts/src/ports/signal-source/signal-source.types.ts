/**
 * The ways a system asks a program to stop. `SIGBREAK` is Windows' Ctrl+Break,
 * `SIGHUP` is the terminal itself going away.
 */
export const ALL_SIGNALS = ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"] as const;

/** One signal name, drawn from {@link ALL_SIGNALS}. */
export type SystemSignal = (typeof ALL_SIGNALS)[number];

/** Called on every delivery of the signal it was registered for. */
export type SignalHandler = (signal: SystemSignal) => void;

/** Drops a subscription. Calling it more than once is harmless. */
export type Unsubscribe = () => void;

/**
 * Where a program hears the system asking it to stop.
 *
 * The double matters more than usual here: raising a true SIGINT inside a test
 * run stops the test runner, not the code under test.
 */
export interface SignalSource {
  on(signal: SystemSignal, handler: SignalHandler): Unsubscribe;
}
