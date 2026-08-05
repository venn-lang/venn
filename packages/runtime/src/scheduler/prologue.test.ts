import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

/**
 * A test file's top-level statements are its prologue: they run once, in order,
 * before the flows, the same as a script's, because the same lines have to mean
 * the same thing in both.
 */
describe("the prologue a test file runs before its flows", () => {
  it("opens what the statements open, exposes it to the flows, and closes it after", async () => {
    let closed = false;
    const plugin = definePlugin({
      name: "@test/r",
      namespace: "r",
      actions: [
        defineAction({
          name: "open",
          run: () => ({
            ready: true,
            close: () => {
              closed = true;
            },
          }),
        }),
      ],
    });

    const source = `const base = 42
const conn = r.open
defer { conn.close() }

flow "F" {
  step "s" {
    expect conn.ready == true
    expect base == 42
  }
}`;
    const { ast, problems } = parse(source);
    expect(problems).toEqual([]);
    const runner = createRunner({
      host: createTestHost(),
      plugins: [plugin],
      sink: createMemorySink(),
    });

    const result = await runner.run(ast);

    expect(result.failed).toBe(0);
    expect(result.passed).toBe(2);
    expect(closed).toBe(true);
  });
});
