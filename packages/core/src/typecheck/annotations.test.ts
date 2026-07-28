import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";
import { showType } from "./show.js";
import type { Type } from "./type.types.js";

/**
 * Written annotations, exercised.
 *
 * Every bug this file pins had the same cause: nothing in the repo ever wrote
 * one. `list<T>` sent the checker into infinite recursion, `type X = A | B`
 * became an empty record that rejected everything, `?` made a field mandatory,
 * and `const x: T` was parsed and thrown away, all of it invisible because the
 * suite only ever asserted on types the checker had inferred for itself.
 */

function typeOf(source: string, name: string, kind = "LetStmt"): string | undefined {
  const checked = checkTypes(parse(source).ast);
  for (const [node, type] of checked.types) {
    const decl = node as { name?: string; $type?: string };
    if (decl.$type === kind && decl.name === name) return showType(type as Type);
  }
  return undefined;
}

function problems(source: string): string[] {
  return checkTypes(parse(source).ast).problems.map((problem) => problem.title);
}

describe("generic annotations", () => {
  it("reads a type argument instead of reading itself forever", () => {
    expect(() => checkTypes(parse("fn f(xs: list<number>) => xs").ast)).not.toThrow();
    expect(typeOf("fn f(xs: list<number>) => xs", "xs", "Param")).toBe("list<number>");
  });

  it("survives nesting", () => {
    expect(typeOf("fn f(xs: list<list<string>>) => xs", "xs", "Param")).toBe("list<list<string>>");
  });

  it("reads a generic inside a type declaration", () => {
    const source = ["type Cart { items: list<string> }", "fn f(c: Cart) => c.items"].join("\n");

    expect(() => checkTypes(parse(source).ast)).not.toThrow();
    expect(typeOf(source, "c", "Param")).toContain("list<string>");
  });
});

describe("type declarations", () => {
  // `type Plan = "free" | "pro"` is the spec's own example.
  it("reads an alias, rather than treating it as a shape with no fields", () => {
    const source = ['type Plan = "free" | "pro"', "fn pick(p: Plan) => p"].join("\n");

    expect(typeOf(source, "p", "Param")).toBe('"free" | "pro"');
    expect(problems(source)).toEqual([]);
  });

  it("lets an optional field be absent", () => {
    const source = [
      "type User { name: string, nickname?: string }",
      'const u: User = { name: "ada" }',
    ].join("\n");

    expect(problems(source)).toEqual([]);
  });

  it("still requires what was not marked optional", () => {
    const source = ["type User { name: string, age: number }", 'const u: User = { name: "ada" }'];

    expect(problems(source.join("\n")).length).toBeGreaterThan(0);
  });
});

describe("a declared type is checked", () => {
  it("accepts a value of the declared type", () => {
    expect(problems("const n: number = 3")).toEqual([]);
  });

  it("reports a value that contradicts it", () => {
    expect(problems('const n: number = "three"').length).toBeGreaterThan(0);
  });

  it("keeps the written type on the binding, not the inferred one", () => {
    expect(typeOf("const xs: list<number> = []", "xs")).toBe("list<number>");
  });
});
