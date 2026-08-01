import { describe, expect, it } from "vitest";
import { parse } from "./index.js";

/** The titles reported for a source, which is what a reader sees. */
function titles(source: string): string[] {
  return parse(source).problems.map((problem) => problem.title);
}

/**
 * A `try` where an argument goes.
 *
 * An argument is one value and a `try` is two with a word between, so the
 * grammar ends the argument list and reads the statement form instead. What the
 * parser then said was that it wanted a `{`.
 */
describe("a try used as an argument", () => {
  it("says brackets are what it needs, and writes the line out", () => {
    const said = titles("fn f() => 1\nprint try f() else 0");

    expect(said[0]).toBe(
      "An argument is one value, so a `try` has to be bracketed. Write `print (try f() else 0)`.",
    );
  });

  it("says it for a catch as well", () => {
    const said = titles("fn f() => 1\nprint try f() catch e => e.code");

    expect(said[0]).toContain("Write `print (try f() catch e => e.code)`");
  });

  it("says it for a dotted verb", () => {
    const said = titles('io.print try f() else "none"');

    expect(said[0]).toContain('Write `io.print (try f() else "none")`');
  });

  /** Bracketed, it is an argument like any other and there is nothing to say. */
  it("says nothing once it is bracketed", () => {
    expect(titles("fn f() => 1\nprint (try f() else 0)")).toEqual([]);
  });

  /** The statement form opens a block, and that is not this mistake. */
  it("says nothing about a try that is a statement", () => {
    expect(titles("try {\n  print 1\n} catch e {\n  print 2\n}")).toEqual([]);
  });
});
