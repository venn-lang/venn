import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";
import { showType } from "./show.js";
import type { Type } from "./type.types.js";

/** The type inference settled on for the `fn` named `name`. */
function fnType(source: string, name: string): string | undefined {
  const checked = checkTypes(parse(source).ast);
  for (const [node, type] of checked.types) {
    const decl = node as { name?: string; $type?: string };
    if (decl.$type === "FnDecl" && decl.name === name) return showType(type as Type);
  }
  return undefined;
}

function problems(source: string): string[] {
  return checkTypes(parse(source).ast).problems.map((problem) => problem.title);
}

/**
 * A `fn` body reading a value the file declares at the top level.
 *
 * Those bindings are bound after the function bodies are checked, and have to
 * be, since generalising a `fn` first is what lets two callers use it at two
 * types. Without the seeding pass every such read answers `dynamic`, and a
 * single `const` at the top of a file strips the types from every helper below.
 */
describe("a fn body reads the file's own values", () => {
  it("sees a const declared above it", () => {
    const source = [
      "type Corpo { data: list<number> }",
      "const corpo: Corpo = { data: [] }",
      "fn primeiro() => corpo.data",
    ].join("\n");

    expect(fnType(source, "primeiro")).toBe("fn() -> list<number>");
  });

  /** The function runs later, so where the value is written does not matter. */
  it("sees one declared below it", () => {
    const source = [
      "fn primeiro() => corpo.data",
      "type Corpo { data: list<number> }",
      "const corpo: Corpo = { data: [] }",
    ].join("\n");

    expect(fnType(source, "primeiro")).toBe("fn() -> list<number>");
  });

  /** What the ordering bought in the first place, and must keep buying. */
  it("leaves a generic helper usable at two types", () => {
    const source = ["fn ident(x) => x", "const a = ident(1)", 'const b = ident("s")'].join("\n");

    expect(problems(source)).toEqual([]);
  });

  it("still lets a value call a function declared below it", () => {
    const source = ["const n = dobro(2)", "fn dobro(x: number) -> number => x * 2"].join("\n");

    expect(problems(source)).toEqual([]);
  });
});
