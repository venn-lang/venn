import { describe, expect, it } from "vitest";
import { parse } from "./index.js";

/** The titles reported for a source, which is what a reader sees. */
function titles(source: string): string[] {
  return parse(source).problems.map((problem) => problem.title);
}

const COMMA =
  "Items inside `( )` and `[ ]` are separated by a comma, and a newline there is not one.";

/**
 * A line broken for readability inside `( )` or `[ ]`.
 *
 * The lexer drops the newlines there on purpose, so a call may span lines. The
 * cost is that the separator a reader thought they wrote is gone before the
 * parser sees the items, and the parser cannot name what it never received.
 */
describe("a comma missing inside brackets", () => {
  it.each([
    ["a list literal", "const xs = [\n  1\n  2\n]"],
    ["a parameter list", "fn f(\n  a\n  b\n) => a"],
    ["a list pattern", "const [a b] = xs"],
    ["one line", "const xs = [1 2]"],
  ])("names the comma in %s", (_what, source) => {
    expect(titles(source)[0]).toBe(COMMA);
  });

  /**
   * `print` alone is already a whole call and therefore a whole declaration, so
   * a `print(` whose arguments do not parse leaves the parser having finished
   * the file, and the report landed on the `(` several lines above the mistake.
   */
  it("moves the report off the opening bracket and onto the item that wanted it", () => {
    const found = parse("print([\n  1\n  2\n])").problems.find((one) => one.title === COMMA);

    expect(`${found?.span.line}:${found?.span.column}`).toBe("3:3");
  });

  it("says nothing once the commas are written", () => {
    expect(titles("const xs = [\n  1,\n  2\n]")).toEqual([]);
    expect(titles("print(\n  1,\n  2\n)")).toEqual([]);
  });

  /** A `{` gives the newlines back, so a break inside one separates properly. */
  it("says nothing about a map written over several lines inside a call", () => {
    expect(titles("fn f(m) => m\nprint(f({\n  a: 1\n  b: 2\n}))")).toEqual([]);
  });
});
