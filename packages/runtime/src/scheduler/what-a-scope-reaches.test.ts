import { createSystemClock, createTestHost } from "@venn-lang/contracts";
import type { Envelope } from "@venn-lang/core";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/index.js";

/**
 * The three places a cancelled scope did not reach.
 *
 * A compiled `fn` body, which has no scheduler between two passes; a `finally`,
 * which is the block a cancelled body most needs; and a step that overran
 * without ever yielding, which nobody was left to report on. Each program below
 * is bounded by something these fixes do not touch, so a failure is a test that
 * fails rather than a suite that never returns.
 */
function harness(): { seen: string[]; plugin: PluginDefinition } {
  const seen: string[] = [];
  const actions = [
    defineAction({ name: "record", run: (_c, i) => void seen.push(String(i.args[0])) }),
    defineAction({ name: "burn", run: burn }),
  ];
  return {
    seen,
    plugin: definePlugin({ name: "@t/reach", namespace: "t", actions }),
  };
}

/** One statement that overruns without yielding, and with no boundary to spare. */
function burn(): void {
  const until = Date.now() + 120;
  while (Date.now() < until) {
    // Deliberately busy: an action that slept would give the timer its turn.
  }
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

/**
 * The one a signal cannot reach even in principle: the loop is inside a `fn`, so
 * it is compiled into thunks and there is no scheduler between two passes to ask
 * anything of. The cap is enormous rather than absent so that a failure is a slow
 * test rather than a suite that never returns.
 */
const COMPILED_SPIN = `fn spin(cap: number) -> number {
  loop n = 0 {
    if n > cap { break }
    continue n + 1
  }
  return 1
}

flow "F" {
  @timeout(50ms)
  step "spin" {
    let answer = spin(1000000000)
    t.record "finished"
  }
}`;

describe("a loop written inside a function", () => {
  it("is stopped by the timeout around the step that called it", { timeout: 30_000 }, async () => {
    const t = harness();
    const started = Date.now();
    const events = await ran(COMPILED_SPIN, t.plugin);

    expect(JSON.stringify(events)).toContain("Timed out after 50ms");
    expect(t.seen).toEqual([]);
    // Uninterrupted, a thousand million passes take far longer than this.
    expect(Date.now() - started).toBeLessThan(5000);
  });
});

const FINALLY = `flow "F" {
  race {
    step "fast" { t.record "fast" }
    step "slow" {
      try {
        wait 5s
      } finally {
        t.record "tidied up"
      }
    }
  }
}`;

describe("a finalizer in a branch that was cut off", () => {
  it("runs, because giving back what the body took is why it is written", async () => {
    const t = harness();
    await ran(FINALLY, t.plugin);

    expect(t.seen).toEqual(["fast", "tidied up"]);
  });
});

/**
 * A step that overran with nothing to interrupt: one statement, so no boundary
 * ever sampled the clock, and the timer that would have fired never got a turn.
 * It used to report as having passed, which is the one answer it must not give.
 */
const OVERRAN = `flow "F" {
  @timeout(20ms)
  step "overran" { t.burn }
}`;

describe("a step that ran past its deadline without ever yielding", () => {
  it("is reported as having run out of time", async () => {
    const events = await ran(OVERRAN, harness().plugin);

    expect(JSON.stringify(events)).toContain("Timed out after 20ms");
  });
});
