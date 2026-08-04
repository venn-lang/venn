import type { Clock } from "@venn-lang/contracts";
import type { CancelScope, CancelScopeArgs, Expiry } from "./cancel.types.js";

/**
 * How many boundaries pass between two readings of the clock.
 *
 * A deadline is the only thing that can stop work which never yields, and the
 * boundary it is read at is the hottest line in the runtime. Reading the clock
 * every time costs about as much as a whole loop pass; reading it once every 64
 * costs under a nanosecond amortised, and the overshoot it buys is 64
 * statements.
 */
const SAMPLE = 63;

/** The counters a scope keeps while it runs. */
interface Live {
  reason: unknown;
  ticks: number;
}

/**
 * Build a scope under `args.parent`.
 *
 * @param args The scope above, the run's clock, and this scope's own deadline.
 * @returns A scope that ends when it is cancelled, when its deadline passes, or
 * when anything above it does.
 */
export function createCancelScope(args: CancelScopeArgs): CancelScope {
  const controller = new AbortController();
  const live: Live = { reason: undefined, ticks: 0 };
  const cancel = ender(controller, live);
  const expiry = soonest(args);
  return {
    signal: controller.signal,
    expiry,
    stopped: () => live.reason ?? overdue({ live, expiry, clock: args.clock, cancel }),
    cancel,
    release: inheritFrom(args.parent, cancel),
  };
}

/** The one way a scope ends: the first reason wins, and the signal follows it. */
function ender(controller: AbortController, live: Live): (reason: unknown) => void {
  return (reason) => {
    if (live.reason !== undefined) return;
    live.reason = reason;
    controller.abort();
  };
}

/**
 * The deadline this scope answers to: its own, the one it inherits, or the
 * earlier of the two. Folded in once, here, so no read has to ask a parent.
 */
function soonest(args: CancelScopeArgs): Expiry | undefined {
  const inherited = args.parent?.expiry;
  if (!args.timeout) return inherited;
  const own: Expiry = { at: args.clock.now() + args.timeout.ms, raise: args.timeout.raise };
  return inherited && inherited.at <= own.at ? inherited : own;
}

interface Overdue {
  live: Live;
  expiry: Expiry | undefined;
  clock: Clock;
  cancel: (reason: unknown) => void;
}

/**
 * Whether the deadline has passed, asked of the clock once every {@link SAMPLE}
 * calls. Returns what to throw, so the caller's read stays one call and one
 * comparison.
 */
function overdue(args: Overdue): unknown {
  const { live, expiry } = args;
  if (!expiry) return undefined;
  live.ticks = (live.ticks + 1) & SAMPLE;
  if (live.ticks !== 0 || args.clock.now() < expiry.at) return undefined;
  args.cancel(expiry.raise());
  return live.reason;
}

/**
 * The parent's end, forwarded here once.
 *
 * A listener rather than `AbortSignal.any`: a composed signal answers `.aborted`
 * by asking every source it was built from, which measured fifteen times a plain
 * read and grew with the nesting. This is read at every statement, so the child
 * keeps a plain controller of its own and reads flat however deep it sits.
 *
 * @returns How to let the parent go, which a finished scope owes a long run.
 */
function inheritFrom(parent: CancelScope | undefined, cancel: (why: unknown) => void): () => void {
  if (!parent) return noop;
  const already = parent.stopped();
  if (already !== undefined) {
    cancel(already);
    return noop;
  }
  const forward = (): void => cancel(parent.stopped());
  parent.signal.addEventListener("abort", forward, { once: true });
  return () => parent.signal.removeEventListener("abort", forward);
}

function noop(): void {}
