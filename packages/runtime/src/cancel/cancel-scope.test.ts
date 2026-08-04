import { createVirtualClock } from "@venn-lang/contracts";
import { describe, expect, it } from "vitest";
import type { CancelScope } from "./index.js";
import { createCancelScope, unwind } from "./index.js";

/** Reasons are compared by identity, so anything distinguishable will do. */
const REASON = { why: "called off" };

/** A scope whose deadline this test moves the clock past by hand. */
function bounded(ms: number, past: number): CancelScope {
  const clock = createVirtualClock();
  const scope = createCancelScope({ clock, timeout: { ms, raise: () => REASON } });
  clock.advance(past);
  return scope;
}

/** The deadline is sampled, so it takes a run of boundaries to be noticed. */
function askUntilStopped(scope: CancelScope): unknown {
  for (let at = 0; at < 500; at += 1) {
    const stop = scope.stopped();
    if (stop !== undefined) return stop;
  }
  return undefined;
}

/** A scope ended before its child was built, which the child inherits at birth. */
function underAnEndedParent(): CancelScope {
  const clock = createVirtualClock();
  const parent = createCancelScope({ clock });
  parent.cancel(REASON);
  return createCancelScope({ parent, clock });
}

/** The tighter of two deadlines, which is the only one either scope answers to. */
function underABoundedParent(): CancelScope {
  const clock = createVirtualClock();
  const parent = createCancelScope({ clock, timeout: { ms: 50, raise: () => REASON } });
  return createCancelScope({ parent, clock, timeout: { ms: 5000, raise: () => ({}) } });
}

describe("a scope with a deadline", () => {
  it("goes on while there is time left, however often it is asked", () => {
    expect(askUntilStopped(bounded(100, 99))).toBeUndefined();
  });

  it("ends once the clock has passed it", () => {
    expect(askUntilStopped(bounded(100, 101))).toBe(REASON);
  });
});

describe("a scope built under one that has already ended", () => {
  it("is born ended, since nothing under a called-off scope may run", () => {
    expect(underAnEndedParent().stopped()).toBe(REASON);
  });

  it("carries the abort too, so an action it reaches hears it at once", () => {
    expect(underAnEndedParent().signal.aborted).toBe(true);
  });
});

describe("a scope under one that still has time", () => {
  it("answers to the earlier of the two deadlines", () => {
    expect(underABoundedParent().expiry?.at).toBe(50);
  });
});

describe("waiting for cancelled work to unwind", () => {
  it("is over at once when there was nothing in flight", async () => {
    expect(await unwind({ work: [] })).toBe(true);
  });

  it("says so when the work stopped", async () => {
    expect(await unwind({ work: [Promise.resolve()], graceMs: 50 })).toBe(true);
  });
});

/**
 * The answer that matters: `false` means work was left running, and the caller
 * owes the reader a `VN8002` rather than a verdict over it.
 */
describe("work that never stops", () => {
  it("is given up on after the grace, rather than becoming the hang it prevents", async () => {
    const never = new Promise<void>(() => {});

    expect(await unwind({ work: [never], graceMs: 20 })).toBe(false);
  });
});
