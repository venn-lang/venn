// biome-ignore-all lint/suspicious/noTemplateCurlyInString: Venn source under test.
import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

/** A verb that genuinely waits, so nothing here can pass by finishing early. */
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
          await new Promise((resolve) => setTimeout(resolve, 1));
          return `<${String(input.args[0] ?? "")}>`;
        },
      }),
      defineAction({ name: "fast", run: (_ctx, input) => String(input.args[0] ?? "") }),
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
 * A verb called from inside an expression hands back the promise it runs on,
 * because expressions compile synchronously. Statement position is already
 * asynchronous, so it waits, and `[object Promise]` never reaches the program.
 */
describe("a statement waits for what it reads", () => {
  it("binds what a function that called a verb returned", async () => {
    const t = harness();
    await run(
      lines(
        'import { t } from "@t/m"',
        "fn wrap(x) => t.slow(x)",
        'let got = wrap("a")',
        "t.show got",
      ),
      t.plugin,
    );

    expect(t.seen).toEqual(["<a>"]);
  });

  it("waits through a chain of functions", async () => {
    const t = harness();
    await run(
      lines(
        'import { t } from "@t/m"',
        "fn inner(x) => t.slow(x)",
        "fn middle(x) => inner(x)",
        "fn outer(x) => middle(x)",
        'let got = outer("deep")',
        "t.show got",
      ),
      t.plugin,
    );

    expect(t.seen).toEqual(["<deep>"]);
  });

  it("waits before passing it to another verb", async () => {
    const t = harness();
    await run(
      lines('import { t } from "@t/m"', "fn wrap(x) => t.slow(x)", 't.show wrap("arg")'),
      t.plugin,
    );

    expect(t.seen).toEqual(["<arg>"]);
  });

  it("waits before deciding an `if`", async () => {
    const t = harness();
    await run(
      lines(
        'import { t } from "@t/m"',
        "fn wrap(x) => t.slow(x)",
        'if wrap("x") {',
        '  t.show "took the branch"',
        "}",
      ),
      t.plugin,
    );

    expect(t.seen).toEqual(["took the branch"]);
  });
});

/**
 * The promise travels up the expression it appears in: every node that meets
 * one chains onto it and hands a promise to its parent, and the statement at
 * the top waits there. That is what makes `async` never need writing.
 */
describe("a value still arriving travels up the expression", () => {
  it("is read from, once it has arrived", async () => {
    const t = harness();
    await run(
      lines(
        'import { t } from "@t/m"',
        'fn wrap() => t.slow("abc")',
        "let n = wrap().len",
        "t.show n",
      ),
      t.plugin,
    );

    expect(t.seen).toEqual(["5"]);
  });

  it("takes part in an operator", async () => {
    const t = harness();
    await run(
      lines(
        'import { t } from "@t/m"',
        'fn wrap() => t.slow("a")',
        'let same = wrap() == "<a>"',
        "t.show same",
      ),
      t.plugin,
    );

    expect(t.seen).toEqual(["true"]);
  });

  it("is interpolated into a string", async () => {
    const t = harness();
    await run(
      lines(
        'import { t } from "@t/m"',
        'fn wrap() => t.slow("x")',
        'let line = "got ${wrap()}"',
        "t.show line",
      ),
      t.plugin,
    );

    expect(t.seen).toEqual(["got <x>"]);
  });

  it("decides a ternary", async () => {
    const t = harness();
    await run(
      lines(
        'import { t } from "@t/m"',
        'fn wrap() => t.slow("y")',
        'let pick = wrap() != null ? "yes" : "no"',
        "t.show pick",
      ),
      t.plugin,
    );

    expect(t.seen).toEqual(["yes"]);
  });

  it("sits inside a map", async () => {
    const t = harness();
    await run(
      lines(
        'import { t } from "@t/m"',
        'fn wrap() => t.slow("z")',
        "let box = { one: wrap() }",
        "t.show box.one",
      ),
      t.plugin,
    );

    expect(t.seen).toEqual(["<z>"]);
  });

  it("is passed on to another function", async () => {
    const t = harness();
    await run(
      lines(
        'import { t } from "@t/m"',
        'fn wrap() => t.slow("q")',
        "fn size(text) => text.len",
        "let n = size(wrap())",
        "t.show n",
      ),
      t.plugin,
    );

    expect(t.seen).toEqual(["3"]);
  });

  // A verb that answers at once waits for nothing, and none of the machinery
  // above should touch it.
  it("leaves a verb that answers immediately alone", async () => {
    const t = harness();
    await run(
      lines(
        'import { t } from "@t/m"',
        'fn now() => t.fast("abc")',
        "let n = now().len",
        "t.show n",
      ),
      t.plugin,
    );

    expect(t.seen).toEqual(["3"]);
  });
});
