import { createTestHost } from "@venn-lang/contracts";
import { type ProblemError, parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "./create-runner.js";

const NEWLINE = String.fromCharCode(10);
const URI = "/main.vn";

/** Run a program, one of the two ways a file is driven, and say what it logged. */
async function driven(lines: string[], walk: "script" | "run"): Promise<string[]> {
  const { ast } = parse(lines.join(NEWLINE), { uri: URI });
  const sink = createMemorySink();
  const runner = createRunner({ host: createTestHost(), plugins: [], sink, uri: URI });
  await runner[walk](ast);
  return sink.envelopes
    .filter((event) => event.kind === "log")
    .map((event) => {
      const data = event.data as { message?: unknown };
      return String(data.message ?? "");
    });
}

/** Run a program's own statements and give back what it logged. */
async function ran(...lines: string[]): Promise<string[]> {
  return driven(lines, "script");
}

/** What running it refused with, as `CODE line:column`, or what it logged. */
async function refusal(...lines: string[]): Promise<string> {
  try {
    return (await ran(...lines)).join("|");
  } catch (thrown) {
    const { problem } = thrown as ProblemError;
    return `${problem.code} ${problem.span.line}:${problem.span.column}`;
  }
}

/** Each calls the other, so neither can be read only after the one below it. */
const EACH_CALLS_THE_OTHER = [
  "fn isEven(n) {",
  "  if n == 0 { return true }",
  "  return isOdd(n - 1)",
  "}",
  "fn isOdd(n) {",
  "  if n == 0 { return false }",
  "  return isEven(n - 1)",
  "}",
  "log isEven(4)",
  "log isOdd(4)",
];

async function twoFunctionsThatCallEachOther(): Promise<void> {
  expect(await ran(...EACH_CALLS_THE_OTHER)).toEqual(["true", "false"]);
}

async function aFunctionThatCallsItself(): Promise<void> {
  const said = await ran("fn fact(n) => n <= 1 ? 1 : n * fact(n - 1)", "log fact(5)");

  expect(said).toEqual(["120"]);
}

async function aFunctionThatCallsOneDeclaredBelowIt(): Promise<void> {
  const said = await ran("fn top() => bottom() + 1", "fn bottom() => 6", "log top()");

  expect(said).toEqual(["7"]);
}

/** A closure bound by the `let` it reads is that `let`, not one below it. */
async function aClosureThatCallsItself(): Promise<void> {
  const said = await ran(
    "fn made() {",
    "  let fact = fn (n) => n <= 1 ? 1 : n * fact(n - 1)",
    "  return fact(5)",
    "}",
    "log made()",
  );

  expect(said).toEqual(["120"]);
}

/** The first program of venn-lang/venn#299, refused where the name is read. */
const ABOVE_ITS_LET = [
  "fn made() {",
  "  let see = fn () => later",
  '  let later = "bound after"',
  "  return see()",
  "}",
  "log made()",
];

/** The second, where the pass that bound the name has ended by call time. */
const ABOVE_ITS_LET_IN_A_PASS = [
  "let made = []",
  "forEach n in [1, 2] {",
  "  made = made.push(fn () => y)",
  "  let y = n",
  "}",
  "log made.map((f) => f())",
];

/**
 * A `flow` runs after the file's own statements, and `bindGlobals` binds every
 * top-level name before the first one does, so a `let` written below a `flow`
 * is in view inside it. This is the one shape the outward walk stops short of,
 * and it is why it stops at the file rather than at each frame on the way.
 */
const A_TOP_LEVEL_LET_BELOW_THE_FLOW = [
  'flow "F" {',
  '  step "s" {',
  "    let see = fn () => later",
  '    log "${see()}"',
  "  }",
  "}",
  "let later = 7",
];

/**
 * A name read before it is bound, in the four shapes that used to answer
 * differently and the three that have to keep working.
 *
 * The three are the point: a `fn` is bound for the whole file, so calling one
 * declared below is how mutual recursion is written, and the `let` a closure
 * sits inside is above it and not below. Only a `let` written under the closure
 * that reads it is refused.
 */
describe("a closure written above the binding it reads", () => {
  it("is refused where the name is read", async () => {
    expect(await refusal(...ABOVE_ITS_LET)).toBe("VN2026 2:22");
  });

  it("is refused in a loop pass too, where the binding is gone by call time", async () => {
    expect(await refusal(...ABOVE_ITS_LET_IN_A_PASS)).toBe("VN2026 3:29");
  });

  it("leaves mutual recursion between two `fn` declarations alone", twoFunctionsThatCallEachOther);
  it("leaves a `fn` that calls itself alone", aFunctionThatCallsItself);
  it("leaves a call to a `fn` declared below alone", aFunctionThatCallsOneDeclaredBelowIt);
  it("leaves a closure that calls itself alone", aClosureThatCallsItself);
});

/**
 * The one shape the outward walk stops short of, and why it stops at the file
 * rather than at each frame on the way.
 */
describe("a closure inside a `flow`", () => {
  it("reads a top-level binding written below the `flow` that holds it", async () => {
    expect(await driven(A_TOP_LEVEL_LET_BELOW_THE_FLOW, "run")).toEqual(["7"]);
  });
});
