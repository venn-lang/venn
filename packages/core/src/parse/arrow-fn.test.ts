import { describe, expect, it } from "vitest";
import { evaluate } from "../expr/index.js";
import type { Document, LetStmt } from "../generated/ast.js";
import { parse } from "./parse.js";

/** Parse `const a = <source>` and run it. */
function run(source: string): unknown {
  const { ast, problems } = parse(`const a = ${source}\n`);
  expect(problems).toEqual([]);
  const decl = (ast as Document).decls[0] as LetStmt;
  return evaluate(decl.value, { lookup: () => undefined });
}

const shape = (source: string): string => {
  const { ast, problems } = parse(`const a = ${source}\n`);
  expect(problems).toEqual([]);
  return ((ast as Document).decls[0] as LetStmt).value.$type;
};

/**
 * The arrow form, for the shape everyone already has in their fingers. One
 * parameter needs no brackets; more than one does, the same rule JavaScript
 * uses. `fn (x) => …` still means exactly the same thing.
 */
describe("arrow functions", () => {
  it("takes one parameter without brackets", () => {
    expect(shape("x => x * 2")).toBe("FnExpr");
    expect(run("[1, 2, 3].map(x => x * 2)")).toEqual([2, 4, 6]);
  });

  it("takes several, in brackets", () => {
    expect(run("[10, 20].map((x, i) => x + i)")).toEqual([10, 21]);
  });

  it("takes one in brackets, and none at all", () => {
    expect(run("[1, 2].map((x) => x + 1)")).toEqual([2, 3]);
    expect(run("(() => 42)()")).toBe(42);
  });

  it("declares types, once it has brackets to hang them on", () => {
    expect(run("[1, 2].map((x: number) -> number => x + 1)")).toEqual([2, 3]);
  });

  /**
   * `f(x: number => …)` is a named argument called `x`, so an unbracketed
   * parameter carries no type. TypeScript settled on the same rule for the
   * same reason.
   */
  it("leaves named arguments alone", () => {
    expect(shape("n => n")).toBe("FnExpr");
    const { ast, problems } = parse("const a = f(x: n => n)\n");
    expect(problems).toEqual([]);
    expect(ast).toBeDefined();
  });

  it("still accepts the `fn` it grew up with", () => {
    expect(run("[1, 2].map(fn (x) => x * 2)")).toEqual([2, 4]);
    expect(run("[1, 2].map(fn (x, i) => x + i)")).toEqual([1, 3]);
  });

  /**
   * The case the grammar had to be checked against: `(a) => b` and `(a)` differ
   * only at the fourth token, and `(1 + 2)` must stay arithmetic.
   */
  it("leaves ordinary brackets alone", () => {
    expect(run("(1 + 2) * 3")).toBe(9);
    expect(shape("(1 + 2)")).toBe("Binary");
    expect(shape("(5)")).toBe("NumberLit");
  });

  it("nests, and closes over what it can see", () => {
    expect(run("[1, 2].map(x => [10, 20].map(y => x + y))")).toEqual([
      [11, 21],
      [12, 22],
    ]);
  });
});
