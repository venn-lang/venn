import { createTestHost } from "@venn/contracts";
import { parse } from "@venn/core";
import { defineAction, definePlugin } from "@venn/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

describe("env and matrix", () => {
  it("binds env globals and expands matrix variants", async () => {
    const seen: string[] = [];
    const plugin = definePlugin({
      name: "@t/m",
      version: "0",
      namespace: "t",
      actions: [
        defineAction({
          name: "record",
          run: (_ctx, input) => {
            seen.push(String(input.args[0]));
          },
        }),
      ],
    });
    const { ast, problems } = parse(`matrix { browser: ["chromium", "webkit"] }
flow "F" {
  step "s" {
    t.record matrix.browser
    expect env.BASE == "http://x"
  }
}`);
    expect(problems).toEqual([]);
    const runner = createRunner({
      host: createTestHost(),
      plugins: [plugin],
      sink: createMemorySink(),
      env: { BASE: "http://x" },
    });

    const result = await runner.run(ast);

    expect(seen).toEqual(["chromium", "webkit"]);
    expect(result.failed).toBe(0);
    expect(result.passed).toBe(2);
  });
});
