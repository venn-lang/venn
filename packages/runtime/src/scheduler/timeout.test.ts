import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/index.js";

/** What the work did after it was told to stop, which is the whole question. */
let wentOn = false;

const SLOW = definePlugin({
  name: "@t/slow",
  version: "0",
  namespace: "slow",
  actions: [
    defineAction({
      name: "work",
      run: (ctx) =>
        new Promise((settle, fail) => {
          const timer = setTimeout(() => {
            wentOn = true;
            settle(1);
          }, 200);
          ctx.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            fail(new Error("cancelled"));
          });
        }),
    }),
  ],
});

async function ran(source: string) {
  wentOn = false;
  const sink = createMemorySink();
  const runner = createRunner({ host: createTestHost(), plugins: [SLOW], sink });
  await runner.run(parse(source).ast);
  return sink.envelopes;
}

/**
 * A step given less time than it takes.
 *
 * `@timeout` is what ends a run that should have ended, since `loop` is
 * deliberately uncapped, so the failure it produces is the one a person sees
 * when a flow hangs.
 */
describe("a step that ran out of time", () => {
  // What the timeout ends is the work, not the waiting. It used to end only the
  // waiting: the body carried on to completion past the verdict, which is how a
  // retried step came to run three copies of itself at once.
  it("fails, saying how long it was given, and the work stops", async () => {
    const source = '@timeout(20ms)\nflow "F" {\n  step "s" {\n    slow.work\n  }\n}';
    const events = await ran(source);
    const flow = events.find((one) => one.kind === "flow.finished");
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(flow?.data).toMatchObject({ status: "failed" });
    expect(JSON.stringify(events)).toContain("Timed out after 20ms");
    expect(wentOn).toBe(false);
  });

  it("lets a step that finishes in time alone", async () => {
    const source = '@timeout(2s)\nflow "F" {\n  step "s" {\n    slow.work\n  }\n}';
    const events = await ran(source);

    expect(events.find((one) => one.kind === "flow.finished")?.data).toMatchObject({
      status: "passed",
    });
  });
});
