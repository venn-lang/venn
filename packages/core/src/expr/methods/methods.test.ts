import { describe, expect, it } from "vitest";
import type { Document } from "../../generated/ast.js";
import { isLetStmt } from "../../generated/ast.js";
import { parse, parseExpression } from "../../parse/index.js";
import type { EvalEnv } from "../eval-env.types.js";
import { evaluate } from "../evaluate.js";

/** Evaluate `expr`, with any leading `const` bindings in scope. */
function run(program: string, expr: string): unknown {
  const bindings: Record<string, unknown> = {};
  const env: EvalEnv = { lookup: (name) => bindings[name] };
  for (const decl of (parse(program).ast as Document).decls) {
    if (isLetStmt(decl)) bindings[decl.name] = evaluate(decl.value, env);
  }
  const parsed = parseExpression(expr);
  if (!parsed) throw new Error(`could not parse: ${expr}`);
  return evaluate(parsed, env);
}

describe("list methods", () => {
  it("maps, filters and reduces", () => {
    expect(run("", "[1, 2, 3].map(fn (x) => x * 2)")).toEqual([2, 4, 6]);
    expect(run("", "[1, 2, 3, 4].filter(fn (x) => x % 2 == 0)")).toEqual([2, 4]);
    expect(run("", "[1, 2, 3, 4].reduce(fn (a, x) => a + x, 0)")).toBe(10);
  });

  it("reads length, first and last as properties", () => {
    expect(run("", "[10, 20, 30].len")).toBe(3);
    expect(run("", "[10, 20, 30].first")).toBe(10);
    expect(run("", "[10, 20, 30].last")).toBe(30);
  });

  it("finds, sorts and joins", () => {
    expect(run("", "[1, 2, 3].find(fn (x) => x > 1)")).toBe(2);
    expect(run("", "[3, 1, 2].sort(fn (a, b) => a - b)")).toEqual([1, 2, 3]);
    expect(run("", "[1, 2, 3].join('-')")).toBe("1-2-3");
  });

  it("chains", () => {
    const expr = "[1, 2, 3, 4].filter(fn (x) => x > 1).map(fn (x) => x * 10)";
    expect(run("", expr)).toEqual([20, 30, 40]);
  });
});

describe("string methods", () => {
  it("transforms as properties", () => {
    expect(run("", "'aBc'.upper")).toBe("ABC");
    expect(run("", "'aBc'.lower")).toBe("abc");
    expect(run("", "'  x  '.trim")).toBe("x");
    expect(run("", "'abc'.reverse")).toBe("cba");
  });

  it("splits, replaces and tests", () => {
    expect(run("", "'a,b,c'.split(',')")).toEqual(["a", "b", "c"]);
    expect(run("", "'aXbXc'.replace('X', '-')")).toBe("a-b-c");
    expect(run("", "'hello'.startsWith('he')")).toBe(true);
  });
});

describe("map methods", () => {
  const person = "const p = { name: 'Ada', age: 36 }";

  it("reads keys, values and length", () => {
    expect(run(person, "p.keys")).toEqual(["name", "age"]);
    expect(run(person, "p.values")).toEqual(["Ada", 36]);
    expect(run(person, "p.len")).toBe(2);
  });

  it("checks membership and gets values", () => {
    expect(run(person, "p.has('age')")).toBe(true);
    expect(run(person, "p.has('nope')")).toBe(false);
    expect(run(person, "p.get('name')")).toBe("Ada");
  });

  it("lets a data key of the same name as a method win", () => {
    expect(run("const m = { keys: 42 }", "m.keys")).toBe(42);
  });
});
