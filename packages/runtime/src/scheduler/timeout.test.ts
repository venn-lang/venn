import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/index.js";

const SLOW = definePlugin({
  name: "@t/slow",
  version: "0",
  namespace: "slow",
  actions: [
    defineAction({
      name: "work",
      run: () => new Promise((settle) => setTimeout(() => settle(1), 200)),
    }),
  ],
});

async function ran(source: string) {
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
  // The step never finishes, which is the point: what ends is the flow around
  // it, and the reason arrives as the log the runner writes before it does.
  it("fails, saying how long it was given", async () => {
    const source = '@timeout(20ms)\nflow "F" {\n  step "s" {\n    slow.work\n  }\n}';
    const events = await ran(source);
    const flow = events.find((one) => one.kind === "flow.finished");

    expect(flow?.data).toMatchObject({ status: "failed" });
    expect(JSON.stringify(events)).toContain("Timed out after 20ms");
  });

  it("lets a step that finishes in time alone", async () => {
    const source = '@timeout(2s)\nflow "F" {\n  step "s" {\n    slow.work\n  }\n}';
    const events = await ran(source);

    expect(events.find((one) => one.kind === "flow.finished")?.data).toMatchObject({
      status: "passed",
    });
  });
});
