import { describe, expect, it } from "vitest";
import { parse } from "./parse.js";

/** Every problem a source earns, as `CODE title` plus the help under it. */
function said(source: string): string[] {
  return parse(source).problems.map((one) => `${one.code} ${one.title}${under(one.help)}`);
}

function under(help: string | undefined): string {
  return help ? ` // ${help}` : "";
}

/**
 * `a += 2` lexes as a name, a `+`, an `=` and a number, so the grammar reads a
 * verb called `a` handed an argument and stops at the `+`. What came back was
 * ``An argument is one value, so `+` has to be bracketed``, about a line with no
 * argument in it and nothing to bracket, and `x++` got the same sentence.
 *
 * Venn has no compound assignment and no increment. Plain assignment is the
 * spelling, and it is what these say, having been run before being written down.
 */
describe("an operator brought in from another language", () => {
  it("names the compound assignment, and the assignment that replaces it", () => {
    expect(said("let a = 1\na += 2")).toEqual(["VN1005 Venn has no `+=`. // Write `a = a + 2`."]);
  });

  it("says the same of every arithmetic one", () => {
    const shapes: [string, string][] = [
      ["-=", "Write `a = a - 2`."],
      ["*=", "Write `a = a * 2`."],
      ["/=", "Write `a = a / 2`."],
      ["%=", "Write `a = a % 2`."],
    ];

    for (const [written, help] of shapes) {
      expect(said(`let a = 1\na ${written} 2`), written).toEqual([
        `VN1005 Venn has no \`${written}\`. // ${help}`,
      ]);
    }
  });

  it("names the increment, and the addition that replaces it", () => {
    expect(said("let x = 1\nx++")).toEqual(["VN1005 Venn has no `++`. // Write `x = x + 1`."]);
    expect(said("let x = 1\nx--")).toEqual(["VN1005 Venn has no `--`. // Write `x = x - 1`."]);
  });

  /** The wake of the one mistake, which used to be reported as a second one. */
  it("says it once, and does not ask for a bracket as well", () => {
    const found = said("let a = 1\na += 2\nprint a");

    expect(found).toHaveLength(1);
    expect(found[0]).not.toContain("bracketed");
  });

  it("points at the operator itself", () => {
    const [problem] = parse("let a = 1\na += 2").problems;

    expect([problem?.span.line, problem?.span.column]).toEqual([2, 3]);
    expect(problem?.span.length).toBe(2);
  });

  /** A `+=` the parser never stopped at is text, not an operator. */
  it("leaves one inside a string alone", () => {
    expect(said('print "a += 2"')).toEqual([]);
    expect(said("# a += 2\nprint 1")).toEqual([]);
  });

  it("leaves the operators the language does have alone", () => {
    expect(said("let a = 1\nprint (a >= 1)")).toEqual([]);
    expect(said("let a = 1\nprint (a != 2)")).toEqual([]);
    expect(said("let a = 1\na = a + 2")).toEqual([]);
  });
});
