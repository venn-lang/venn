import { describe, expect, it } from "vitest";
import type { EvalEnv } from "../expr/eval-env.types.js";
import { evaluate } from "../expr/evaluate.js";
import { callClosure } from "../expr/invoke.js";
import type { Document, FnDecl } from "../generated/ast.js";
import { isFnDecl, isLetStmt } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import { closureOfDecl } from "./compile.js";

const NEWLINE = String.fromCharCode(10);

/** Parse a program and evaluate `expression` with its top-level `fn`s in scope. */
function run(source: string, expression: string): unknown {
  const program = parse(source).ast as Document;
  const bindings: Record<string, unknown> = {};
  const env: EvalEnv = { lookup: (name) => bindings[name] };
  for (const decl of program.decls) {
    if (isFnDecl(decl)) bindings[decl.name] = closureOfDecl(decl, env);
    else if (isLetStmt(decl) && decl.name) bindings[decl.name] = evaluate(decl.value, env);
  }
  const main = (parse(`fn __main() => ${expression}`).ast as Document).decls[0] as FnDecl;
  return callClosure(closureOfDecl(main, env), []);
}

/**
 * A function body that holds statements.
 *
 * It was bindings and one expression: no `if`, no early `return`, no loop. So
 * every branch had to be a ternary and every fold a `reduce`, and a function
 * that wanted to stop early could not.
 *
 * The body is still compiled, and still to slots and a frame. A statement is a
 * step over that frame rather than anything a scheduler runs, which is what
 * keeps a call as cheap as it was.
 */
describe("a function body with statements", () => {
  it("decides, and leaves early", () => {
    const source = [
      "fn classify(n) {",
      "  if n < 0 {",
      '    return "negative"',
      "  }",
      '  return "positive"',
      "}",
    ].join(NEWLINE);

    expect(run(source, "classify(-3)")).toBe("negative");
    expect(run(source, "classify(3)")).toBe("positive");
  });

  it("takes an else, and an else if", () => {
    const source = [
      "fn size(n) {",
      "  if n < 10 {",
      '    return "small"',
      "  } else if n < 100 {",
      '    return "medium"',
      "  } else {",
      '    return "large"',
      "  }",
      "}",
    ].join(NEWLINE);

    expect(run(source, "size(5)")).toBe("small");
    expect(run(source, "size(50)")).toBe("medium");
    expect(run(source, "size(500)")).toBe("large");
  });

  it("loops, and adds up as it goes", () => {
    const source = [
      "fn total(xs) {",
      "  let sum = 0",
      "  forEach x in xs {",
      "    sum = sum + x",
      "  }",
      "  return sum",
      "}",
    ].join(NEWLINE);

    expect(run(source, "total([1, 2, 3, 4])")).toBe(10);
  });

  /** Out of the loop and out of the function, in one word. */
  it("returns from inside a loop", () => {
    const source = [
      "fn firstBig(xs) {",
      "  forEach x in xs {",
      "    if x > 10 {",
      "      return x",
      "    }",
      "  }",
      "  return null",
      "}",
    ].join(NEWLINE);

    expect(run(source, "firstBig([1, 20, 3])")).toBe(20);
    expect(run(source, "firstBig([1, 2])")).toBeNull();
  });

  it("breaks out of a loop without leaving the function", () => {
    const source = [
      "fn upTo(xs, limit) {",
      "  let sum = 0",
      "  forEach x in xs {",
      "    if x > limit {",
      "      break",
      "    }",
      "    sum = sum + x",
      "  }",
      "  return sum",
      "}",
    ].join(NEWLINE);

    expect(run(source, "upTo([1, 2, 90, 4], 10)")).toBe(3);
  });

  it("repeats a known number of times", () => {
    const source = [
      "fn double(n) {",
      "  let out = n",
      "  repeat 3 {",
      "    out = out * 2",
      "  }",
      "  return out",
      "}",
    ].join(NEWLINE);

    expect(run(source, "double(1)")).toBe(8);
  });

  /** `as` names the pass, and the first pass is pass one, not pass zero. */
  it("counts the passes of a repeat from one", () => {
    const source = [
      "fn passes(n) {",
      "  let seen = []",
      "  repeat n as i {",
      "    seen = seen.push(i)",
      "  }",
      "  return seen",
      "}",
    ].join(NEWLINE);

    expect(run(source, "passes(3)")).toEqual([1, 2, 3]);
  });

  it("takes the open loop, and its state", () => {
    const source = [
      "fn countTo(limit) {",
      "  loop at = 0 {",
      "    if at >= limit {",
      "      return at",
      "    }",
      "    at = at + 1",
      "  }",
      "  return 0",
      "}",
    ].join(NEWLINE);

    expect(run(source, "countTo(4)")).toBe(4);
  });

  it("binds inside a branch, and reads it after", () => {
    const source = [
      "fn label(n) {",
      '  let name = "small"',
      "  if n > 10 {",
      '    name = "large"',
      "  }",
      "  return name",
      "}",
    ].join(NEWLINE);

    expect(run(source, "label(50)")).toBe("large");
    expect(run(source, "label(5)")).toBe("small");
  });

  /** A `return` with nothing after it hands back the one nothing there is. */
  it("hands back nothing when a return says nothing", () => {
    const source = ["fn nothing() {", "  return", "}"].join(NEWLINE);

    expect(run(source, "nothing()")).toBeNull();
  });
});

describe("what a body without statements still does", () => {
  it("ends in its last expression, as it always did", () => {
    const source = ["fn area(w, h) {", "  const a = w * h", "  a", "}"].join(NEWLINE);

    expect(run(source, "area(6, 7)")).toBe(42);
  });

  it("takes the one-expression form", () => {
    expect(run("fn twice(n) => n * 2", "twice(21)")).toBe(42);
  });
});

/** The corners: a body that binds late, takes things apart, and writes into them. */
describe("the rest of what a body may do", () => {
  it("binds after a statement, not only before one", () => {
    const source = [
      "fn late(n) {",
      "  if n < 0 {",
      "    return 0",
      "  }",
      "  let doubled = n * 2",
      "  return doubled",
      "}",
    ].join(NEWLINE);

    expect(run(source, "late(21)")).toBe(42);
  });

  it("takes a value apart where it binds it", () => {
    const source = [
      "fn nameOf(user) {",
      "  if user == null {",
      '    return "nobody"',
      "  }",
      "  let { name } = user",
      "  return name",
      "}",
    ].join(NEWLINE);

    expect(run(source, 'nameOf({ name: "ana" })')).toBe("ana");
  });

  it("takes each item apart as it loops", () => {
    const source = [
      "fn totalOf(rows) {",
      "  let sum = 0",
      "  forEach { price } in rows {",
      "    sum = sum + price",
      "  }",
      "  return sum",
      "}",
    ].join(NEWLINE);

    expect(run(source, "totalOf([{ price: 2 }, { price: 3 }])")).toBe(5);
  });

  it("writes into a field and into an item", () => {
    const source = [
      "fn filled(n) {",
      "  const out = { total: 0, seats: [0, 0] }",
      "  out.total = n",
      "  out.seats[1] = n",
      "  return out",
      "}",
    ].join(NEWLINE);

    expect(run(source, "filled(7)")).toEqual({ total: 7, seats: [0, 7] });
  });

  it("loops while a condition holds", () => {
    const source = [
      "fn halveUntilOdd(n) {",
      "  let at = n",
      "  loop at % 2 == 0 {",
      "    at = at / 2",
      "  }",
      "  return at",
      "}",
    ].join(NEWLINE);

    expect(run(source, "halveUntilOdd(40)")).toBe(5);
  });

  /** Past this one and on to the next, rather than out of the loop. */
  it("goes on to the next pass", () => {
    const source = [
      "fn oddsOnly(xs) {",
      "  let sum = 0",
      "  forEach x in xs {",
      "    if x % 2 == 0 {",
      "      continue",
      "    }",
      "    sum = sum + x",
      "  }",
      "  return sum",
      "}",
    ].join(NEWLINE);

    expect(run(source, "oddsOnly([1, 2, 3, 4, 5])")).toBe(9);
  });
});
