import type { Clock } from "@venn-lang/contracts";

/** When a scope runs out of time, and what running out of it means. */
export interface Expiry {
  /** The reading of the run's clock this scope may not outlive. */
  readonly at: number;
  /** The failure the deadline stands for, built when it is reached. */
  readonly raise: () => unknown;
}

/**
 * One scope's end: its own, and every end it inherited.
 *
 * A scope is made per `@timeout`, per `race` and per `parallel`. Its parent is
 * asked once, when it is built, and never again: the parent's abort is
 * forwarded here and the parent's deadline is folded into this one. What a
 * statement boundary reads is therefore one plain signal and one number,
 * however deep the scopes nest.
 */
export interface CancelScope {
  /** Handed to actions and to `Clock.sleep`, so work already in flight hears it. */
  readonly signal: AbortSignal;
  /** The soonest deadline over this scope and the ones above it. */
  readonly expiry: Expiry | undefined;
  /**
   * What ended this scope, ready to be thrown, or `undefined` while it runs.
   *
   * Read at every statement boundary and every loop back edge, which is the
   * hottest line in the runtime, so it answers from a field and a comparison
   * and reads the clock only every so often.
   */
  stopped(): unknown;
  /** End this scope, and everything built under it, carrying `reason`. */
  cancel(reason: unknown): void;
  /** Let go of the scope above: a finished scope still holds a listener on it. */
  release(): void;
}

/** What a new scope inherits, and what it adds of its own. */
export interface CancelScopeArgs {
  /** The scope this one is nested in, when there is one. */
  readonly parent?: CancelScope;
  /** Where a deadline reads the time. */
  readonly clock: Clock;
  /** How long this scope has, and what it fails as when it runs out. */
  readonly timeout?: { readonly ms: number; readonly raise: () => unknown };
}

/** What waiting for cancelled work to stop needs. */
export interface UnwindArgs {
  /** What was cancelled, already settling. */
  readonly work: readonly Promise<unknown>[];
  /** How long to wait before giving up. Defaults to the standard grace. */
  readonly graceMs?: number;
}
