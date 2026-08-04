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

  /**
   * Every other syntax error is still the parser's, and is still said as a line
   * about the file rather than in the names a parser generator has for its own
   * token types.
   */
  it("says what could have gone there for every other syntax error", () => {
    expect(titles("const = 1")[0]).toBe(
      "Expected a name, an opening brace or an opening square bracket here, found an equals sign.",
    );
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

  /**
   * The line the operator is on has to be a call before a bracket can go round
   * anything on it. `CALLED` admitted every statement keyword, so `let in = 1`
   * was answered with "write `let (in= 1)`", which is not a call, and is
   * missing a space besides.
   */
  describe("a line that is not a call at all", () => {
    it("says nothing about a binding whose name was a keyword", () => {
      const said = titles("let in = 1")[0] ?? "";

      expect(said).not.toContain("has to be bracketed");
      expect(said).not.toContain("let (in");
      expect(said).toBe(
        "Expected a name, an opening brace or an opening square bracket here, found `in`.",
      );
    });

    it("says nothing about an import, and never swallows its `from`", () => {
      const said = titles('import a + b from "x"').join("\n");

      expect(said).not.toContain("has to be bracketed");
      expect(said).not.toContain('from "x")');
    });

    /** The statement inside the block is judged on its own words, not the
     * block's, so a call written in one still gets its explanation. */
    it("still explains a call written inside a block", () => {
      const said = titles('flow "f" { print a + b }');

      expect(said[0]).toContain("so `+` has to be bracketed");
    });

    it("stops the suggestion where the next clause begins", () => {
      expect(titles("print a + b as c")[0]).toBe(
        "An argument is one value, so `+` has to be bracketed. Write `print (a + b)`.",
      );
    });

    /** A value may hold a keyword, so the cut is only for the ones that open a
     * clause of their own. */
    it("keeps a word that is part of the value it stops at", () => {
      expect(titles("print a + true")[0]).toContain("Write `print (a + true)`");
    });
  });

  /**
   * The end of the file carries no position. It was reported as NaN, then as the
   * top of the file, which read as a claim about line one however far down the
   * file actually stopped.
   */
  it("points at the end of the file when the file just stops", () => {
    const problems = parse('flow "f" {').problems;

    expect(problems[0]?.span.line).toBe(1);
    expect(problems[0]?.span.column).toBe(11);
  });
});
