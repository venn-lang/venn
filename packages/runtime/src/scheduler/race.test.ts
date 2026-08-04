import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

// "fast" settles immediately; "slow" parks on `t.gate` until the test releases it.
const SOURCE = `flow "F" {
  race {
    step "fast" { t.record "fast" }
    step "slow" {
      t.gate
      t.record "slow"
    }
  }
}`;

describe("race cancellation", () => {
  it("stops the losing branch at its next statement boundary", async () => {
    const seen: string[] = [];
    let release = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const plugin = definePlugin({
      name: "@t/m",
      version: "0",
      namespace: "t",
      actions: [
        // Honours `ctx.signal`, which is what an action owes the scope it runs
        // in. A race now waits for its losers to stop before it reports, so one
        // that never stops is one the whole run waits on.
        defineAction({
          name: "gate",
          run: (ctx) =>
            new Promise<void>((resolve, reject) => {
              void gate.then(resolve);
              ctx.signal?.addEventListener("abort", () => reject(new Error("cancelled")));
            }),
        }),
        defineAction({
          name: "record",
          run: (_ctx, input) => {
            seen.push(String(input.args[0]));
          },
        }),
      ],
    });
    const { ast, problems } = parse(SOURCE);
    expect(problems).toEqual([]);
    const runner = createRunner({
      host: createTestHost(),
      plugins: [plugin],
      sink: createMemorySink(),
    });

    await runner.run(ast);
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(seen).toEqual(["fast"]);
  });
});

/**
 * `Promise.race([])` is pending for ever, so an empty block used to delete
 * everything after it from the run: no `run.finished`, no `teardown`, and the
 * process left with 0 because the event loop had drained.
 */
const EMPTY = `flow "one" {
  race { }
  expect 1 == 2
}
flow "two" { log "two ran" }`;

describe("a race with no branches", () => {
  it("settles at once, so the rest of the run still happens", async () => {
    const sink = createMemorySink();
    const runner = createRunner({ host: createTestHost(), plugins: [], sink });

    await runner.run(parse(EMPTY).ast);
    const kinds = sink.envelopes.map((one) => one.kind);

    expect(kinds).toContain("run.finished");
    expect(JSON.stringify(sink.envelopes)).toContain("two ran");
  });
});
