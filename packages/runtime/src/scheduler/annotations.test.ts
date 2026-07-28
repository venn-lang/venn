import { createTestHost } from "@venn/contracts";
import { parse } from "@venn/core";
import { defineAction, definePlugin } from "@venn/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

describe("execution annotations", () => {
  it("@retry re-runs a step until a stateful action passes", async () => {
    let calls = 0;
    const plugin = definePlugin({
      name: "@t/r",
      version: "0",
      namespace: "t",
      actions: [defineAction({ name: "flaky", run: () => ({ ok: ++calls >= 2 }) })],
    });
    const { ast } = parse(`flow "F" {
  @retry(2)
  step "s" {
    let res = t.flaky
    expect res.ok == true
  }
}`);
    const sink = createMemorySink();
    const runner = createRunner({ host: createTestHost(), plugins: [plugin], sink });

    const result = await runner.run(ast);

    expect(calls).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.passed).toBe(1);
    expect(sink.envelopes.some((e) => e.kind === "flow.retrying")).toBe(true);
  });

  it("@lock serializes parallel steps sharing a resource without deadlock", async () => {
    const plugin = definePlugin({
      name: "@t/l",
      version: "0",
      namespace: "t",
      actions: [defineAction({ name: "noop", run: () => undefined })],
    });
    const { ast } = parse(`flow "F" {
  parallel {
    @lock("res") step "a" { t.noop; expect true }
    @lock("res") step "b" { t.noop; expect true }
  }
}`);
    const runner = createRunner({
      host: createTestHost(),
      plugins: [plugin],
      sink: createMemorySink(),
    });

    const result = await runner.run(ast);

    expect(result.failed).toBe(0);
    expect(result.passed).toBe(2);
  });

  it("@tags filters which flows run", async () => {
    const { ast } = parse(`@tags(smoke)
flow "A" { step "s" { expect true } }

flow "B" { step "s" { expect false } }`);
    const runner = createRunner({
      host: createTestHost(),
      plugins: [],
      sink: createMemorySink(),
      filter: { tags: ["smoke"] },
    });

    const result = await runner.run(ast);

    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
  });
});
