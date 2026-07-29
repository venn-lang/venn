import { describe, expect, it } from "vitest";
import { parse } from "./index.js";

/** The titles reported for a source, which is what a reader sees. */
function titles(source: string): string[] {
  return parse(source).problems.map((problem) => problem.title);
}

describe("an argument holding an operator", () => {
  /**
   * The case this was opened for. The parser's own words were "Expecting token
   * of type EOF but found `+`", which explains none of what to do.
   */
  it("says brackets are what it needs, and writes the line out", () => {
    expect(titles("print 300ms + 1s")).toEqual([
      "An argument cannot hold `+` unless it is bracketed. Write `print (300ms + 1s)`.",
    ]);
  });

  it("says the same for an operator that is a word", () => {
    const said = titles("const xs = [1]\nprint 1 in xs");

    expect(said[0]).toContain("cannot hold `in`");
    expect(said[0]).toContain("Write `print (1 in xs)`");
  });

  it("covers the operators people reach for", () => {
    for (const operator of ["+", "-", "*", "/", "%", "==", "!=", "<", ">", "&&", "||", "??"]) {
      const said = titles(`print a ${operator} b`);

      expect(said[0], operator).toContain(`cannot hold \`${operator}\``);
    }
  });

  /** The suggestion has to be something that actually parses. */
  it("suggests a line that parses", () => {
    const said = titles("print 300ms + 1s");
    const suggested = /Write `(.+)`\./.exec(said[0] ?? "")?.[1];

    expect(suggested).toBe("print (300ms + 1s)");
    expect(parse(suggested ?? "").problems).toEqual([]);
  });

  /** The line, not the rest of the file, when the mistake is not on the last one. */
  it("writes out only the line the operator is on", () => {
    const said = titles('print 300ms + 1s\nprint "after"\n');

    expect(said[0]).toContain("Write `print (300ms + 1s)`");
    expect(said[0]).not.toContain("after");
  });

  it("leaves every other syntax error in the parser's words", () => {
    expect(titles("const = 1")[0]).toContain("Expecting token of type");
  });

  /**
   * A suggestion that does not quite work is worse than none, so it is left out
   * when the line carries a block or is too long to read back.
   */
  it("explains without a suggestion when the line holds a block", () => {
    const said = titles('flow "f" { print a + b }');

    expect(said[0]).toContain("cannot hold `+`");
    expect(said[0]).toContain("Put brackets around the whole argument.");
    expect(said[0]).not.toContain("Write");
  });

  it("explains without a suggestion when there is nothing before the operator", () => {
    const said = titles("+ 1");

    expect(said.join("\n")).not.toContain("Write `");
  });

  it("explains without a suggestion when nothing on the line is spaced apart", () => {
    const said = titles("a+b");

    expect(said[0]).toContain("cannot hold `+`");
    expect(said[0]).not.toContain("Write `");
  });

  it("explains without a suggestion when the line is too long to read back", () => {
    const long = `print ${"a".repeat(30)} + ${"b".repeat(30)}`;

    expect(titles(long)[0]).not.toContain("Write `");
  });

  /** The end of the file carries no position, and used to be reported as NaN. */
  it("points somewhere real when the file just stops", () => {
    const problems = parse('flow "f" {').problems;

    expect(problems[0]?.span.line).toBe(1);
    expect(problems[0]?.span.column).toBe(1);
  });
});
