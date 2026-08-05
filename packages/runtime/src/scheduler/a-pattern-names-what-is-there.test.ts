import { createTestHost } from "@venn-lang/contracts";
import { type Envelope, ProblemError, parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/index.js";

/** What a script left behind: the refusal it raised, if any, and what it logged. */
interface Ran {
  readonly refusal?: ProblemError;
  readonly logged: readonly string[];
}

/**
 * Run a script and hand back its refusal beside what it printed.
 *
 * A crash is rethrown rather than answered as a clean run: a raw `TypeError` out
 * of the destructuring path is the failure VN3026 exists to replace, so a helper
 * that spells both of them `undefined` stays green through the regression. The
 * output travels with it because a pattern is judged by what it bound, and a row
 * that reads only the absence of a refusal cannot tell `[2, 3]` from `[3]`.
 */
async function ran(...lines: string[]): Promise<Ran> {
  const { ast, problems } = parse(lines.join("\n"));
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const sink = createMemorySink();
  const runner = createRunner({ host: createTestHost(), plugins: [], sink });
  const refusal = await runner.script(ast).then(() => undefined, asRefusal);
  return { refusal, logged: logsOf(sink) };
}

/** What a script printed, having first refused nothing: the shape a good run has. */
async function printedBy(...lines: string[]): Promise<readonly string[]> {
  const { refusal, logged } = await ran(...lines);

  expect(refusal?.problem).toBeUndefined();
  return logged;
}

/** A refusal is the rule speaking; anything else is a crash and stays a crash. */
function asRefusal(error: unknown): ProblemError {
  if (error instanceof ProblemError) return error;
  throw error;
}

/** Every message a `log` statement put on the sink, in order. */
function logsOf(sink: MemorySink): string[] {
  return sink.envelopes.filter(isLog).map((event) => event.data.message);
}

/** The narrowing that lets a log's own payload be read as one. */
function isLog(event: Envelope): event is Envelope<"log"> {
  return event.kind === "log";
}

describe("a list pattern that names more than the list holds", () => {
  it("refuses a `let`, where it used to bind the extra name to nothing", async () => {
    const { refusal, logged } = await ran("let [a, b, c] = [1, 2]", "log a");

    expect(refusal?.problem).toMatchObject({
      code: "VN3026",
      title: "This pattern names 3 items, and the list has 2.",
      severity: "error",
      help: "Name fewer items, or read them by position instead.",
    });
    expect(logged).toEqual([]);
  });

  it("refuses a `forEach`, which is where the sweep found it", async () => {
    const { refusal, logged } = await ran("forEach [a, b, c] in [[1, 2]] {", "  log a", "}");

    expect(refusal?.problem.title).toBe("This pattern names 3 items, and the list has 2.");
    expect(logged).toEqual([]);
  });

  it("points at the pattern, not at the statement around it", async () => {
    const { refusal } = await ran("let [a, b, c] = [1, 2]", "log a");

    expect(refusal?.problem.span.line).toBe(1);
    expect(refusal?.problem.span.length).toBe("[a, b, c]".length);
  });
});

describe("a list pattern that names fewer than the list holds", () => {
  /** The rule `match` already keeps: a pattern describes a shape or it does not. */
  it("refuses the silently dropped tail", async () => {
    const { refusal } = await ran("let [a, b] = [1, 2, 3]", "log a");

    expect(refusal?.problem).toMatchObject({
      code: "VN3026",
      title: "This pattern names 2 items, and the list has 3.",
      help: "Name the rest, or write `...rest` last to take what is left.",
    });
  });

  it("takes the tail where a `...rest` asks for it", async () => {
    expect(await printedBy("let [a, ...rest] = [1, 2, 3]", "log rest")).toEqual(["[2, 3]"]);
  });

  it("still counts the names before a `...rest`", async () => {
    const { refusal } = await ran("let [a, b, c, ...rest] = [1, 2]", "log a");

    expect(refusal?.problem.title).toBe(
      "This pattern names 3 items before `...`, and the list has 2.",
    );
  });
});

describe("what still works, in every position a pattern can appear", () => {
  it("reads a pair out of `entries`, which is the shape the language wants", async () => {
    const lines = ["let m = { a: 1, b: 2 }", "forEach [k, v] in m.entries {", "  log k", "}"];

    expect(await printedBy(...lines)).toEqual(["a", "b"]);
  });

  it("takes a `const` apart at the exact length", async () => {
    expect(await printedBy("const [a, b] = [1, 2]", "log b")).toEqual(["2"]);
  });

  it("takes a map apart, which this rule does not touch", async () => {
    expect(await printedBy("let { a, b } = { a: 1, b: 2 }", "log a")).toEqual(["1"]);
  });

  it("takes a nested pattern apart", async () => {
    expect(await printedBy("let { a: [x, y] } = { a: [1, 2] }", "log y")).toEqual(["2"]);
  });

  it("binds a fragment's parameter through a pattern", async () => {
    const lines = ["fragment show([a, b]) {", "  log a", "}", "run show([1, 2])"];

    expect(await printedBy(...lines)).toEqual(["1"]);
  });

  it("refuses that same parameter when the caller is one short", async () => {
    const lines = ["fragment show([a, b]) {", "  log a", "}", "run show([1])"];

    expect((await ran(...lines)).refusal?.problem.code).toBe("VN3026");
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

    expect(await printedBy(...lines)).toEqual(["other"]);
  });
});

describe("what the rule will not claim", () => {
  /** Not a list at all is a different mistake, reported where the shape is known. */
  it("says nothing about a value that is not a list", async () => {
    expect(await printedBy("let m = { a: 1 }", "let { a } = m", "log a")).toEqual(["1"]);
  });

  it("says nothing when a nested read runs out before the pattern does", async () => {
    expect(await printedBy("let { a: { b } } = { a: { b: 1 } }", "log b")).toEqual(["1"]);
  });
});
