import { createTestHost } from "@venn/contracts";
import { parse } from "@venn/core";
import { defineAction, definePlugin } from "@venn/sdk";
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
        defineAction({ name: "gate", run: () => gate }),
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
