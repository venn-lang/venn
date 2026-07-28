import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";
import { showType } from "./show.js";
import type { Type } from "./type.types.js";

/** The type inference settled on for the parameter named `name`. */
function paramType(source: string, name: string): string | undefined {
  const checked = checkTypes(parse(source).ast);
  for (const [node, type] of checked.types) {
    const decl = node as { name?: string; $type?: string };
    if (decl.$type === "Param" && decl.name === name) return showType(type as Type);
  }
  return undefined;
}

function problems(source: string): string[] {
  return checkTypes(parse(source).ast).problems.map((problem) => problem.title);
}

describe("a named fn learns from its callers", () => {
  it("takes the type it is called with", () => {
    const source = ["fn double(x) => x + x", "const n = double(21)"].join("\n");

    expect(paramType(source, "x")).toBe("number");
  });

  it("takes a whole record, fields and all", () => {
    const source = [
      "fn greet(user) => user.name",
      'const who = greet({ name: "ada", age: 36 })',
    ].join("\n");

    expect(paramType(source, "user")).toContain("name: string");
    expect(paramType(source, "user")).toContain("age: number");
  });

  // Two callers who disagree are no evidence at all: the first would win by
  // accident, and its guess would turn into an error the author never made.
  it("learns nothing when two callers disagree, and blames neither", () => {
    const source = ["fn pick(x) => x", "const a = pick(1)", 'const b = pick("two")'].join("\n");

    expect(paramType(source, "x")).toBe("a");
    expect(problems(source)).toEqual([]);
  });

  // An annotation is the author speaking; nothing inferred may overrule it.
  it("leaves an annotated parameter as written", () => {
    const source = ["fn take(n: string) => n", "const out = take(1)"].join("\n");

    expect(paramType(source, "n")).toBe("string");
  });

  /**
   * Never called, so nothing was said: the parameter stays open, and the helper
   * keeps working at whatever type it is eventually used with.
   */
  it("stays open when nobody calls it", () => {
    expect(paramType("fn identity(x) => x", "x")).toBe("a");
  });

  // A file that does not type-check has no reliable callers to learn from: the
  // first one would win by accident and its guess would become the next error.
  it("learns nothing from a file that already has a mismatch", () => {
    const source = ["fn pick(x) => x", 'const bad = "a" + 1', "const out = pick(2)"].join("\n");

    expect(paramType(source, "x")).toBe("a");
  });
});
