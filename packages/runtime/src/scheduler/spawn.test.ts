import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

function harness() {
  const seen: string[] = [];
  const plugin = definePlugin({
    name: "@t/m",
    version: "0",
    namespace: "t",
    actions: [
      defineAction({
        name: "slow",
        run: async (_ctx, input) => {
          await new Promise((resolve) => setTimeout(resolve, 2));
          seen.push(`ran ${String(input.args[0] ?? "")}`);
          return `<${String(input.args[0] ?? "")}>`;
        },
      }),
      defineAction({
        name: "show",
        run: (_ctx, input) => {
          seen.push(String(input.args[0]));
        },
      }),
    ],
  });
  return { seen, plugin };
}

async function run(source: string, plugin: ReturnType<typeof harness>["plugin"]): Promise<void> {
  const { ast, problems } = parse(source);
  expect(problems).toEqual([]);
  const runner = createRunner({
    host: createTestHost(),
    plugins: [plugin],
    sink: createMemorySink(),
  });
  await runner.script(ast);
}

const lines = (...source: string[]): string => source.join("\n");

/**
 * Every call waits by itself, which is what makes `async` and `await`
 * unnecessary. `spawn` is the other half: start something and carry on.
 */
describe("spawn", () => {
  it("carries on without waiting, and hands back the value later", async () => {
    const t = harness();
    await run(
      lines(
        'use "@t/m"',
        'let job = spawn(fn () => t.slow("a"))',
        't.show "carried on"',
        "let got = job.wait",
        "t.show got",
      ),
      t.plugin,
    );

    // "carried on" lands before the work finishes: that is the whole point.
    expect(t.seen).toEqual(["carried on", "ran a", "<a>"]);
  });

  it("says whether it has finished", async () => {
    const t = harness();
    await run(
      lines(
        'use "@t/m"',
        'let job = spawn(fn () => t.slow("b"))',
        "t.show job.done",
        "let got = job.wait",
        "t.show job.done",
      ),
      t.plugin,
    );

    expect(t.seen).toEqual(["false", "ran b", "true"]);
  });

  it("runs several at once and waits for each", async () => {
    const t = harness();
    await run(
      lines(
        'use "@t/m"',
        'let one = spawn(fn () => t.slow("1"))',
        'let two = spawn(fn () => t.slow("2"))',
        "let a = one.wait",
        "let b = two.wait",
        "t.show a",
        "t.show b",
      ),
      t.plugin,
    );

    // Both started before either was waited for.
    expect(t.seen).toEqual(["ran 1", "ran 2", "<1>", "<2>"]);
  });

  /**
   * A task is not a promise on purpose: binding a promise with `let` would make
   * the statement wait for it, which is exactly what `spawn` exists to avoid.
   */
  it("is not mistaken for the value it will produce", async () => {
    const t = harness();
    await run(
      lines('use "@t/m"', 'let job = spawn(fn () => t.slow("c"))', "t.show typeOf(job)"),
      t.plugin,
    );

    expect(t.seen[0]).not.toBe("<c>");
  });
});
