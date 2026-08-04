import { describe, expect, it } from "vitest";
import * as ast from "../generated/ast.js";
import { parse } from "./index.js";

/** The titles reported for a source, which is what a reader sees. */
function titles(source: string): string[] {
  return parse(source).problems.map((problem) => problem.title);
}

/** The arguments of the last statement, which is the call under test. */
function args(source: string): ast.Expr[] {
  const { ast: document, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const last = document.decls[document.decls.length - 1];
  expect(ast.isActionCall(last)).toBe(true);
  return (last as ast.ActionCall).args;
}

/**
 * A negative argument, and the subtraction it is written a space away from.
 *
 * Brackets after a value are always a call, so `print a (-1)` calls `a` and a
 * negative argument had no spelling at all. It has one now, and how it is
 * written is the whole of what tells the two apart.
 */
describe("a minus where an argument goes", () => {
  it("negates the argument it is written against", () => {
    const found = args("const a = 1\nprint a -1");

    expect(found).toHaveLength(2);
    expect(ast.isUnary(found[1] as ast.Expr)).toBe(true);
  });

  it("negates the first argument as well as a later one", () => {
    expect(args("print -1")).toHaveLength(1);
    expect(args("const a = 1\nprint a -1 -2")).toHaveLength(3);
  });

  it("negates a name, a field and an item, not only a number", () => {
    const source = `const a = 1
const p = { age: 2 }
const xs = [3]
print a -a -p.age -xs[0]`;

    expect(args(source)).toHaveLength(4);
  });

  /** Matcher arguments are argument arguments: one rule, both places. */
  it("negates a matcher's argument the same way", () => {
    expect(titles("const xs = [1]\nexpect xs contains -1")).toEqual([]);
  });

  it("is the operator when it is written as one", () => {
    expect(titles("const a = 1\nprint a - 1")[0]).toContain("Write `print (a - 1)`");
  });

  /** Tight on both sides is arithmetic in every language that spaces this way. */
  it("is the operator when nothing around it is spaced", () => {
    expect(titles("const a = 1\nprint a-1")[0]).toContain("Write `print (a - 1)`");
  });

  it("is the operator when only the value after it is spaced apart", () => {
    expect(titles("const a = 1\nprint a- 1")[0]).toContain("has to be bracketed");
  });

  /** Inside brackets it is an expression, where a minus is what it always was. */
  it("says nothing about a subtraction that was bracketed", () => {
    expect(titles("const a = 1\nprint (a - 1)")).toEqual([]);
    expect(titles("const a = 1\nprint(a, a - 1)")).toEqual([]);
  });

  it("still calls what is written as a call", () => {
    expect(titles('const conn = { close: fn () => "x" }\nprint conn.close()')).toEqual([]);
  });
});

/** What a pattern is told, since there is nothing there to subtract from. */
const TIGHT = "A negative number is written `-1`, with no space after the `-`.";

/**
 * The same rule where a pattern goes.
 *
 * `SignedNumber` is a data type rule, so it joins the images of the tokens it
 * matched across the whitespace between them: `- 1` and `-1` both arrive as
 * `"-1"`, and the nine tests above could not see any of it, because none of it
 * ever reached the check. The one spelling that is a hard error everywhere else
 * in the language was accepted here.
 */
describe("a minus where a pattern goes", () => {
  it("takes a negative number written against the digits", () => {
    expect(titles("const it = match 1 {\n  -1 => 1\n}")).toEqual([]);
  });

  it("refuses one written a space apart, the way an argument is", () => {
    expect(titles("const it = match 1 {\n  - 1 => 1\n}")).toEqual([TIGHT]);
    expect(titles("print - 1")).toHaveLength(1);
  });

  it("refuses one inside a list pattern and inside a map pattern", () => {
    expect(titles("const it = match 1 {\n  [- 1] => 1\n}")).toEqual([TIGHT]);
    expect(titles("const it = match 1 {\n  { a: - 1 } => 1\n}")).toEqual([TIGHT]);
  });

  it("refuses one written as an alternative of an arm", () => {
    expect(titles("const it = match 1 {\n  -1 | - 2 => 1\n}")).toEqual([TIGHT]);
  });

  it("points at the `-` and not at the number it was written apart from", () => {
    const found = parse("const it = match 1 {\n  - 1 => 1\n}").problems;

    expect(found[0]?.span.line).toBe(2);
    expect(found[0]?.span.column).toBe(3);
  });

  /** A newline is not hidden, so the parser refuses it before this check runs. */
  it("leaves a `-` with a newline after it to the parser", () => {
    expect(titles("const it = match 1 {\n  -\n1 => 1\n}")).toEqual([
      "Expected a number here, found the end of the line.",
    ]);
  });
});
