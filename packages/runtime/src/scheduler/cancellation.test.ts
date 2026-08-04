import { createSystemClock, createTestHost } from "@venn-lang/contracts";
import type { Envelope } from "@venn-lang/core";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/index.js";

/**
 * One signal, seen from the outside.
 *
 * Every program here used to run past its own verdict, and two of them never
 * ended at all. Each is bounded by something the fix does not touch, so a test
 * that fails is a test that fails rather than a suite that hangs.
 */
interface Watch {
  seen: string[];
  ticks: number;
  release: () => void;
}

function harness(): { watch: Watch; plugin: PluginDefinition } {
  const gate = deferred();
  const watch: Watch = { seen: [], ticks: 0, release: gate.release };
  return { watch, plugin: pluginFor(watch, gate.promise) };
}

function deferred(): { promise: Promise<void>; release: () => void } {
  let release = (): void => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

function pluginFor(watch: Watch, gate: Promise<void>): PluginDefinition {
  const tick = (): void => {
    watch.ticks += 1;
  };
  // `park` honours `ctx.signal`, which is what an action owes the scope it runs
  // in. One that ignores it cannot be cancelled, and that is the contract,
  // however well the signal composes above it.
  const actions = [
    defineAction({ name: "park", run: (ctx) => park(ctx.signal, gate) }),
    defineAction({ name: "record", run: (_c, i) => void watch.seen.push(String(i.args[0])) }),
    defineAction({ name: "tick", run: tick }),
  ];
  return definePlugin({ name: "@t/cancel", version: "0", namespace: "t", actions });
}

function park(signal: AbortSignal | undefined, gate: Promise<void>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    void gate.then(resolve);
    signal?.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
  });
}

/** A real clock, because a deadline is a reading of one. */
async function ran(source: string, plugin: PluginDefinition): Promise<readonly Envelope[]> {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const sink = createMemorySink();
  const host = createTestHost({ clock: createSystemClock() });
  await createRunner({ host, plugins: [plugin], sink }).run(ast);
  return sink.envelopes;
}

const turn = (): Promise<unknown> => new Promise((resolve) => setTimeout(resolve, 5));

/**
 * The `break` is the bound this cannot hang on: without cancellation the loop
 * ends on its own after five thousand passes and the step passes, which is what
 * tells the two apart.
 */
const RUNAWAY = `flow "F" {
  @timeout(60ms)
  step "runaway" {
    loop n = 0 {
      t.tick
      if n > 5000 { break }
      wait 1ms
      continue n + 1
    }
  }
}`;

describe("a loop that waits, inside a step given less time than it takes", () => {
  it("stops, rather than only its waiting stopping", async () => {
    const t = harness();
    const events = await ran(RUNAWAY, t.plugin);

    expect(JSON.stringify(events)).toContain("Timed out after 60ms");
    expect(t.watch.ticks).toBeLessThan(5000);
  });
});

/**
 * The case a signal can never reach: a loop that never yields starves the event
 * loop, so the timer that would abort it never gets a turn. What ends this is
 * the deadline read from the clock at the loop's own back edge.
 */
const SPIN = `flow "F" {
  @timeout(50ms)
  step "spin" {
    loop n = 0 {
      if n > 50000000 { break }
      continue n + 1
    }
  }
}`;

describe("a loop that never yields", () => {
  it("still ends, because the deadline is read and not waited for", {
    timeout: 30_000,
  }, async () => {
    const events = await ran(SPIN, harness().plugin);

    expect(JSON.stringify(events)).toContain("Timed out after 50ms");
  });
});

const LOCKED = `flow "F" {
  parallel { onError: "collect" } {
    @lock("db") @timeout(30ms)
    step "first" { t.record "first in" t.park t.record "first out" }
    @lock("db")
    step "second" { t.record "second in" }
  }
}`;

describe("a lock whose holder ran out of time", () => {
  it("is handed on only once that holder has actually stopped", async () => {
    const t = harness();
    await ran(LOCKED, t.plugin);
    t.watch.release();
    await turn();

    expect(t.watch.seen).toEqual(["first in", "second in"]);
  });
});

/**
 * The sharpest of the lot. One extra level of nesting used to lose the abort
 * entirely, and the loser reported passed half a second after the run had
 * finished.
 */
const NESTED = `flow "F" {
  race {
    step "fast" { t.record "fast" }
    step "slow" {
      parallel {
        step "inner" { t.park t.record "inner" }
      }
    }
  }
}`;

describe("a race that was decided", () => {
  it("reaches a parallel nested inside the losing branch", async () => {
    const t = harness();
    const events = await ran(NESTED, t.plugin);
    const after = events.length;
    t.watch.release();
    await turn();

    expect(t.watch.seen).toEqual(["fast"]);
    // Nothing may follow `run.finished`, which is the last thing emitted.
    expect(events[after - 1]?.kind).toBe("run.finished");
    expect(events).toHaveLength(after);
  });
});

const POOL = `flow "F" {
  try {
    forEach n in [1, 2, 3, 4, 5, 6] { concurrency: 2 } {
      t.tick
      if n == 1 { fail "boom" }
    }
  } catch e {
    t.record "caught"
  }
}`;

describe("a concurrent forEach one of whose items failed", () => {
  it("stops handing out the rest", async () => {
    const t = harness();
    await ran(POOL, t.plugin);

    expect(t.watch.seen).toEqual(["caught"]);
    expect(t.watch.ticks).toBeLessThan(6);
  });
});

const TIDIED = `flow "F" {
  race {
    step "fast" { t.record "fast" }
    step "slow" {
      defer { t.record "tidied up" }
      wait 5s
    }
  }
}`;

describe("a defer in a branch that was cut off", () => {
  it("still reaches the world it is giving back, before the run ends", async () => {
    const t = harness();
    await ran(TIDIED, t.plugin);

    expect(t.watch.seen).toEqual(["fast", "tidied up"]);
  });
});
