import { createTestHost } from "@venn-lang/contracts";
import { ProblemError, parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/index.js";

/** Run a script and hand back the refusal it raised, or nothing when it ran. */
async function raised(...lines: string[]): Promise<ProblemError | undefined> {
  const { ast, problems } = parse(lines.join("\n"));
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const runner = createRunner({ host: createTestHost(), plugins: [], sink: createMemorySink() });
  const thrown = await runner.script(ast).catch((error: unknown) => error);
  return thrown instanceof ProblemError ? thrown : undefined;
}

describe("a list pattern that names more than the list holds", () => {
  it("refuses a `let`, where it used to bind the extra name to nothing", async () => {
    const failure = await raised("let [a, b, c] = [1, 2]", "log a");

    expect(failure?.problem).toMatchObject({
      code: "VN3026",
      title: "This pattern names 3 items, and the list has 2.",
      severity: "error",
      help: "Name fewer items, or read them by position instead.",
    });
  });

  it("refuses a `forEach`, which is where the sweep found it", async () => {
    const failure = await raised("forEach [a, b, c] in [[1, 2]] {", "  log a", "}");

    expect(failure?.problem.title).toBe("This pattern names 3 items, and the list has 2.");
  });

  it("points at the pattern, not at the statement around it", async () => {
    const failure = await raised("let [a, b, c] = [1, 2]", "log a");

    expect(failure?.problem.span.line).toBe(1);
    expect(failure?.problem.span.length).toBe("[a, b, c]".length);
  });
});

describe("a list pattern that names fewer than the list holds", () => {
  /** The rule `match` already keeps: a pattern describes a shape or it does not. */
  it("refuses the silently dropped tail", async () => {
    const failure = await raised("let [a, b] = [1, 2, 3]", "log a");

    expect(failure?.problem).toMatchObject({
      code: "VN3026",
      title: "This pattern names 2 items, and the list has 3.",
      help: "Name the rest, or write `...rest` last to take what is left.",
    });
  });

  it("takes the tail where a `...rest` asks for it", async () => {
    expect(await raised("let [a, ...rest] = [1, 2, 3]", "log rest")).toBeUndefined();
  });

  it("still counts the names before a `...rest`", async () => {
    const failure = await raised("let [a, b, c, ...rest] = [1, 2]", "log a");

    expect(failure?.problem.title).toBe(
      "This pattern names 3 items before `...`, and the list has 2.",
    );
  });
});

describe("what still works, in every position a pattern can appear", () => {
  it("reads a pair out of `entries`, which is the shape the language wants", async () => {
    const lines = ["let m = { a: 1, b: 2 }", "forEach [k, v] in m.entries {", "  log k", "}"];

    expect(await raised(...lines)).toBeUndefined();
  });

  it("takes a `const` apart at the exact length", async () => {
    expect(await raised("const [a, b] = [1, 2]", "log b")).toBeUndefined();
  });

  it("takes a map apart, which this rule does not touch", async () => {
    expect(await raised("let { a, b } = { a: 1, b: 2 }", "log a")).toBeUndefined();
  });

  it("takes a nested pattern apart", async () => {
    expect(await raised("let { a: [x, y] } = { a: [1, 2] }", "log y")).toBeUndefined();
  });

  it("binds a fragment's parameter through a pattern", async () => {
    const lines = ["fragment show([a, b]) {", "  log a", "}", "run show([1, 2])"];

    expect(await raised(...lines)).toBeUndefined();
  });

  it("refuses that same parameter when the caller is one short", async () => {
    const lines = ["fragment show([a, b]) {", "  log a", "}", "run show([1])"];

    expect((await raised(...lines))?.problem.code).toBe("VN3026");
  });

  /** A `match` arm asks the same question and moves on, which must not change. */
  it("leaves a match arm to fall through rather than refusing it", async () => {
    const lines = [
      "let out = match [1, 2, 3] {",
      '  [a, b] => "pair"',
      '  _ => "other"',
      "}",
      "log out",
    ];

    expect(await raised(...lines)).toBeUndefined();
  });
});

describe("what the rule will not claim", () => {
  /** Not a list at all is a different mistake, reported where the shape is known. */
  it("says nothing about a value that is not a list", async () => {
    expect(await raised("let m = { a: 1 }", "let { a } = m", "log a")).toBeUndefined();
  });

  it("says nothing when a nested read runs out before the pattern does", async () => {
    expect(await raised("let { a: { b } } = { a: { b: 1 } }", "log b")).toBeUndefined();
  });
});
