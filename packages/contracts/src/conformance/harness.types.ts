/**
 * Builds a fresh implementation for a single conformance run.
 *
 * Called once per test rather than once per suite, so no test can observe state
 * another test left behind.
 */
export type PortFactory<T> = () => T | Promise<T>;

/** One implementation under test. */
export interface ConformanceSpec<T> {
  /** Shown in the test name, e.g. "memory" or "node". */
  readonly name: string;
  readonly factory: PortFactory<T>;
}
