import { describe, expect, it } from "vitest";
import { parse } from "./index.js";

/** The titles reported for a source, which is what a reader sees. */
function titles(source: string): string[] {
  return parse(source).problems.map((problem) => problem.title);
}

/**
 * A decorator handed a value with no brackets around it.
 *
 * `@timeout 50ms` was answered with every keyword a statement could have begun
 * with, and the count of the ones it declined to name. Both are true and
 * neither is the mistake: the value belongs to the `@timeout` on the same line,
 * inside brackets, and `@timeout(50ms)` parses clean.
 */
describe("a decorator argument nobody bracketed", () => {
  it("names the decorator and what to write instead", () => {
    expect(titles('flow "F" {\n  @timeout 50ms\n  step "s" { print 1 }\n}\n')).toEqual([
      "A decorator takes its argument in brackets: write `@timeout(50ms)`.",
    ]);
  });

  it("says it for a decorator on a declaration as well as one in a body", () => {
    expect(titles('@retry 3\nflow "F" {\n  step "s" { print 1 }\n}\n')).toEqual([
      "A decorator takes its argument in brackets: write `@retry(3)`.",
    ]);
  });

  it("says it when the block was opened on the same line", () => {
    expect(titles('flow "F" { @timeout 50ms }\n')).toEqual([
      "A decorator takes its argument in brackets: write `@timeout(50ms)`.",
    ]);
  });

  it("says nothing about the bracketed form, which parses", () => {
    expect(titles('flow "F" {\n  @timeout(50ms)\n  step "s" { print 1 }\n}\n')).toEqual([]);
  });

  /** A decorator that takes nothing is written with nothing after it. */
  it("says nothing about a decorator followed by the statement it decorates", () => {
    expect(titles('flow "F" {\n  @only step "s" { print 1 }\n}\n')).toEqual([]);
    expect(titles('flow "F" {\n  @only\n  step "s" { print 1 }\n}\n')).toEqual([]);
  });

  /** With something else on the line the decorator is not what the value follows. */
  it("leaves an error inside a decorator's own brackets alone", () => {
    expect(titles('flow "F" {\n  @timeout(50ms\n}\n')[0]).not.toContain("takes its argument");
  });

  /** A value long enough to quote back would be a paragraph, not a suggestion. */
  it("stops short of quoting back a value nobody could read", () => {
    const long = "x".repeat(80);
    const said = titles(`flow "F" {\n  @tag "${long}"\n  step "s" { print 1 }\n}\n`);

    expect(said[0]).not.toContain("takes its argument");
  });
});
