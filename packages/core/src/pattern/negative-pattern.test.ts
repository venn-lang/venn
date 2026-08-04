import { describe, expect, it } from "vitest";
import { compileExpr } from "../compile/index.js";
import type { EvalEnv } from "../expr/index.js";
import type { Expr, LetStmt, MatchExpr } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import { parse } from "../parse/index.js";

/** Nothing is in scope: every one of these matches on a literal. */
const NOTHING: EvalEnv = { lookup: () => undefined };

/** The expression a `const` binds, evaluated the way a program evaluates it. */
function value(source: string): unknown {
  const { ast: document, problems } = parse(`const it = ${source}`);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const bound = (document.decls[0] as LetStmt).value;
  return compileExpr(bound as Expr)(NOTHING);
}

/** The first pattern of the first arm, which is what the grammar built for it. */
function firstPattern(source: string): ast.Pattern | undefined {
  const { ast: document } = parse(`const it = ${source}`);
  const match = (document.decls[0] as LetStmt).value as MatchExpr;
  return match.arms[0]?.patterns[0];
}

/**
 * A negative number where a pattern goes.
 *
 * `LiteralValue` had no unary minus while `Unary` and `ActionArg` both did, so
 * `match code { -1 => … }` did not parse, and status codes, exit codes and
 * deltas are exactly what people match on. What came out was doubly wrong: the
 * token was `-`, so the argument explainer claimed it and offered brackets on a
 * line with no call in it, where no bracketing helps.
 */
describe("a negative number in a pattern", () => {
  it("parses as one value rather than an operator applied to one", () => {
    const pattern = firstPattern('match -1 {\n  -1 => "gone"\n  other => "?"\n}');

    expect(pattern && ast.isLiteralPattern(pattern)).toBe(true);
    const literal = (pattern as ast.LiteralPattern).value;
    expect(ast.isNumberLit(literal)).toBe(true);
    expect((literal as ast.NumberLit).raw).toBe("-1");
  });

  it("matches the negative value it names", () => {
    expect(value('match -1 {\n  -1 => "gone"\n  other => "?"\n}')).toBe("gone");
  });

  it("does not match the positive one", () => {
    expect(value('match 1 {\n  -1 => "gone"\n  other => "?"\n}')).toBe("?");
  });

  it("tells one negative number from another", () => {
    expect(value('match -2 {\n  -1 => "one"\n  -2 => "two"\n  other => "?"\n}')).toBe("two");
  });

  it("takes one in a list pattern and in a map pattern", () => {
    expect(value('match [-1] {\n  [-1] => "list"\n  other => "?"\n}')).toBe("list");
    expect(value('match { code: -1 } {\n  { code: -1 } => "map"\n  other => "?"\n}')).toBe("map");
  });

  it("takes one as an alternative of an arm", () => {
    expect(value('match -3 {\n  -1 | -3 => "either"\n  other => "?"\n}')).toBe("either");
  });

  /** The advice that used to come out named a `-` on a line with no call. */
  it("is no longer explained as an argument nobody bracketed", () => {
    expect(parse("const it = match x {\n  -1 => 1\n}").problems).toEqual([]);
  });
});
