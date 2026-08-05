import { describe, expect, it } from "vitest";
import { parse } from "./parse.js";
import { verbInALambda } from "./verb-in-a-lambda.js";

const NEWLINE = String.fromCharCode(10);
const URI = "memory://inline.vn";

/**
 * The way out offered where no statement form can carry what the call answers.
 *
 * Both spellings below earn this same sentence, so it is named once: asserting
 * only that one of them is NOT the rewrite is satisfied by any help at all.
 */
const NO_REWRITE =
  "A verb needs a statement of its own. `forEach r in rows { print r }` runs one over each item.";

/**
 * The method spelling of a loop, which is the same mistake as `for` wearing a
 * lambda. `rows.forEach(r => print r)` earned three separate `Expected the end
 * of the file here` for one wrong idea, at the bracket, at the arrow and at the
 * closing bracket, and none of the three named `print` or `forEach`.
 */
describe("a verb handed to a lambda", () => {
  it("says one thing about the call, not three about the end of the file", () => {
    const source = ['let rows = ["a"]', "rows.forEach(r => print r)"].join(NEWLINE);

    const found = parse(source).problems;
    expect(found.map((problem) => problem.code)).toEqual(["VN5010"]);
    expect(found[0]?.title).toBe(
      "A lambda body is one value, and `print` is a verb, so it cannot go in one.",
    );
    expect(found[0]?.help).toBe("Write the statement instead: `forEach r in rows { print r }`.");
  });

  /** The braces read as a map literal, not as a body, so this fails the same way. */
  it("says the same about the braced spelling", () => {
    const source = ['let rows = ["a"]', "rows.forEach(r => { print r })"].join(NEWLINE);

    const found = parse(source).problems;
    expect(found.map((problem) => problem.code)).toEqual(["VN5010"]);
    expect(found[0]?.help).toBe("Write the statement instead: `forEach r in rows { print r }`.");
  });

  it("points at the method spelling, not at the token recovery reached", () => {
    const source = ['flow "F" {', '  let rows = ["a"]', "  rows.forEach(r => print r)", "}"].join(
      NEWLINE,
    );

    const found = parse(source).problems[0];
    expect(found?.span.line).toBe(3);
    expect(found?.span.column).toBe(3);
    expect(found?.span.length).toBe("rows.forEach".length);
  });

  /**
   * `map` has no statement form to rewrite the call into, so it gets the
   * sentence about verbs rather than a rewrite that would not be this call.
   */
  it("offers no rewrite for a method that has no statement form", () => {
    const source = ['let rows = ["a"]', "let z = rows.map(r => print r)"].join(NEWLINE);

    const found = parse(source).problems;
    expect(found.map((problem) => problem.code)).toEqual(["VN5010"]);
    expect(found[0]?.help).toBe(NO_REWRITE);
  });

  /**
   * A statement gives nothing back, so rewriting a call whose result is BOUND
   * would quietly delete the binding the reader wrote. A way out that drops
   * half the line is the failure this pass exists to stop, so the bound form
   * gets the sentence about verbs and keeps its `let`.
   */
  it("offers no rewrite when the result is bound, which a statement cannot keep", () => {
    const source = ['let rows = ["a"]', "let z = rows.forEach(r => print r)"].join(NEWLINE);

    const found = parse(source).problems;
    expect(found.map((problem) => problem.code)).toEqual(["VN5010"]);
    expect(found[0]?.help).toBe(NO_REWRITE);
  });

  /**
   * `io.print(r)` is a call, so it is a value, so the grammar takes it. Whether
   * a lambda may reach the world is `check-pure-verb.ts`'s question and is
   * asked later off the AST; what this holds is that nothing is said HERE,
   * because what the grammar refuses is a statement where a value goes.
   */
  it("says nothing about a namespaced verb, which is a value and parses", () => {
    const source = ['let rows = ["a"]', "rows.forEach(r => io.print(r))"].join(NEWLINE);

    expect(parse(source).problems).toEqual([]);
  });

  it("says nothing about a lambda the parser was happy with", () => {
    const source = ["let rows = [1, 2]", "let z = rows.map(x => x + 1)"].join(NEWLINE);

    expect(parse(source).problems).toEqual([]);
  });
});

/**
 * Every shape the scan must leave alone, with the line and whether the parser
 * stopped on it.
 *
 * `x in ys` reads like juxtaposition and is a word operator; `try … else` and a
 * `match` arm spell themselves with `=>` too; `x.len` has no gap in it; and a
 * `fn` body's arrow belongs to no call. The last row is the guard itself: the
 * one shape that DOES earn a problem, on a line the parser was happy with.
 */
const NOT_A_VERB: [what: string, text: string, stopped: number][] = [
  ["a word operator", "let z = ys.filter(x => x in ys)", 1],
  ["a keyword that opens a value", "let z = ys.map(x => try f(x) else 0)", 1],
  ["a member read", "let z = ys.map(x => x.len)", 1],
  ["an arrow that belongs to no call", "fn f(x: number) -> number => g x", 1],
  ["a line the parser never stopped at", "rows.forEach(r => print r)", 2],
];

/**
 * These ask the scan directly, because through `parse` they cannot be asked: a
 * file that parses is never offered to it at all, which is the whole of the
 * guard against inventing an error on a working program.
 */
describe("what a verb in a lambda is not", () => {
  it.each(NOT_A_VERB)("stays quiet on %s", (_what, text, stopped) => {
    expect(verbInALambda({ text, uri: URI, stopped: new Set([stopped]) })).toEqual([]);
  });
});

/**
 * A help line is a claim, so what is tested is the repaired program and not the
 * words: every diagnostic this pass can raise, and none of them, which is a
 * stronger bar than "it parses". Both spellings were run end to end by hand
 * before they shipped; this is what keeps them true for whoever edits the
 * sentence next, when that run is long gone.
 */
describe("what VN5010's help promises", () => {
  it.each([
    ["the rewrite of the reader's own call", "rows.forEach(r => print r)"],
    ["the sentence for a method with no statement form", "let z = rows.map(r => print r)"],
  ])("hands %s a program that reports nothing", (_what, text) => {
    const help = parse(['let rows = ["a"]', text].join(NEWLINE)).problems[0]?.help ?? "";
    const promised = [...help.matchAll(/`([^`]*\{[^`]*)`/g)].map((found) => found[1] ?? "");

    expect(promised.length).toBeGreaterThan(0);
    for (const snippet of promised) expect(parse(snippet).problems, snippet).toEqual([]);
  });
});
