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
      "An argument is one value, so `+` has to be bracketed. Write `print (300ms + 1s)`.",
    ]);
  });

  it("says the same for an operator that is a word", () => {
    const said = titles("const xs = [1]\nprint 1 in xs");

    expect(said[0]).toContain("so `in` has to be bracketed");
    expect(said[0]).toContain("Write `print (1 in xs)`");
  });

  const OPERATORS = ["+", "-", "*", "/", "%", "==", "!=", "<", ">", "&&", "||", "??"];

  it("covers the operators people reach for", () => {
    for (const operator of OPERATORS) {
      const said = titles(`print a ${operator} b`);

      expect(said[0], operator).toContain(`so \`${operator}\` has to be bracketed`);
    }
  });

  /** What the suggestion says to write has to be something that parses. */
  function suggested(source: string): string | undefined {
    return /Write `(.+)`\./.exec(titles(source)[0] ?? "")?.[1];
  }

  it("suggests a line that parses", () => {
    expect(suggested("print 300ms + 1s")).toBe("print (300ms + 1s)");
    expect(parse("print (300ms + 1s)").problems).toEqual([]);
  });

  /**
   * Every one of them, because a suggestion is code somebody is about to paste.
   * An earlier version offered `print a (-1)` for two arguments, which parses
   * but calls `a`, so parsing alone is not the whole test: the bracketed form
   * has to mean the operation.
   */
  it("suggests something that parses for every operator", () => {
    for (const operator of OPERATORS) {
      const fix = suggested(`print a ${operator} b`);

      expect(fix, operator).toBe(`print (a ${operator} b)`);
      expect(parse(fix ?? "").problems, operator).toEqual([]);
    }
  });

  /**
   * `-` also negates, and how it is written is what says which one it is. Tight
   * against the value, with air before it, it negates; spaced apart on both
   * sides, or on neither, it is the operator and an argument holds no operator.
   */
  it("reads a minus written as a negation as one", () => {
    expect(titles("const a = 1\nprint a -1")).toEqual([]);
    expect(titles("print -1")).toEqual([]);
  });

  it("still reads a spaced minus as the subtraction nobody bracketed", () => {
    expect(suggested("print a - 1")).toBe("print (a - 1)");
    expect(suggested("print a-1")).toBe("print (a - 1)");
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

    expect(said[0]).toContain("so `+` has to be bracketed");
    expect(said[0]).toContain("Put brackets around the whole argument.");
    expect(said[0]).not.toContain("Write");
  });

  it("explains without a suggestion when there is nothing before the operator", () => {
    const said = titles("+ 1");

    expect(said.join("\n")).not.toContain("Write `");
  });

  /** Half-written, which is what the editor sees on most keystrokes. */
  it("explains without a suggestion when the operator has nothing after it", () => {
    const said = titles("const a = 1\nprint a +");

    expect(said[0]).toContain("so `+` has to be bracketed");
    expect(said[0]).not.toContain("Write `");
  });

  it("explains without a suggestion when nothing on the line is spaced apart", () => {
    const said = titles("a+b");

    expect(said[0]).toContain("so `+` has to be bracketed");
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
