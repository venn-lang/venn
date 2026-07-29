import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

/** Type-check a program and return the titles reported. */
function titles(source: string): string[] {
  const { ast } = parse(source);
  return checkTypes(ast).problems.map((problem) => problem.title);
}

describe("calling something that is not a function", () => {
  /**
   * The shape this exists for. Grouping the second argument of an action reads
   * as calling the first, because brackets after a value are always a call, and
   * `expected fn(number) -> number, found number` points nowhere near that.
   */
  it("names the brackets when an argument was being grouped", () => {
    const said = titles("const n = 5\nlet x = thing 1 (n + 1)");

    expect(said[0]).toContain("`1 (n + 1)` reads as a call");
    expect(said[0]).toContain("brackets after a value are always a call");
    expect(said[0]).toContain("separated by commas");
  });

  it("says the same for calling a variable that holds a number", () => {
    expect(titles("const n = 1\nprint n(2)")[0]).toContain("number cannot be called");
  });

  it("says which kind it is", () => {
    expect(titles('const s = "a"\nprint s(2)')[0]).toContain("string cannot be called");
    expect(titles("const xs = [1]\nprint xs(2)")[0]).toContain("cannot be called");
  });

  it("leaves a real function alone", () => {
    expect(titles("fn f(n) => n\nprint f(1)")).toEqual([]);
  });

  it("leaves a method on a value alone", () => {
    expect(titles("const conn = { close: fn () => 1 }\nprint conn.close()")).toEqual([]);
  });

  /**
   * A function called with the wrong number of arguments is a type mismatch, and
   * naming the two types is exactly what a reader needs there. This must not
   * swallow that.
   */
  it("keeps the type mismatch when the callee is a function of another shape", () => {
    const said = titles("fn f(n) => n\nprint f(1, 2)");

    expect(said[0]).toContain("Type mismatch");
    expect(said[0]).not.toContain("cannot be called");
  });

  it("says nothing when the callee's type is still open", () => {
    expect(titles("fn f(g) => g(1)\nprint f(fn (n) => n)")).toEqual([]);
  });

  /** Quoting back half a screen of source helps nobody. */
  it("drops the quote when what was written is too long", () => {
    const long = `const n = 5\nlet x = thing 1 (${"n + ".repeat(12)}1)`;
    const said = titles(long);

    expect(said[0]).toContain("number cannot be called");
    expect(said[0]).not.toContain("reads as a call");
  });
});
