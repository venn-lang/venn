import { describe, expect, it } from "vitest";
import { parse } from "./index.js";

const NEWLINE = String.fromCharCode(10);

/** A program written as lines, the way a body has to be. */
function program(...lines: string[]): string {
  return lines.join(NEWLINE);
}

/** The titles reported for a source, which is what a reader sees. */
function titles(source: string): string[] {
  return parse(source).problems.map((problem) => problem.title);
}

/**
 * A verb inside a `fn`, said in the language's own words.
 *
 * The grammar refuses it, and what the parser had to say about the refusal was
 * that it wanted a `=`: a line that starts with a name is on its way to being an
 * assignment, so the argument is where it stops. That names the token and never
 * the rule, and the rule is the whole of what happened.
 */
describe("a verb written inside a fn", () => {
  it("says a fn is pure, and where the verb belongs", () => {
    const said = titles(program("fn shouts(n) {", '  print "loud"', "  return n", "}"));

    expect(said[0]).toBe(
      "A `fn` is pure, so it cannot call `print`. A verb belongs in a `fragment`, or at the top level of a file.",
    );
  });

  it("says it one level in, where the parse used to succeed", () => {
    const said = titles(
      program("fn shouts(n) {", "  if n > 10 {", '    print "loud"', "  }", "  return n", "}"),
    );

    expect(said[0]).toContain("A `fn` is pure, so it cannot call `print`.");
  });

  it("says it of a dotted verb, and of one called for its effect alone", () => {
    const looped = program(
      "fn f(xs) {",
      "  forEach x in xs {",
      "    http.get x",
      "  }",
      "  return xs",
      "}",
    );
    const closed = program(
      "fn f(conn) {",
      "  if conn != null {",
      "    conn.close()",
      "  }",
      "  return conn",
      "}",
    );

    expect(titles(looped)[0]).toContain("it cannot call `http.get`");
    expect(titles(closed)[0]).toContain("it cannot call `conn.close`");
  });

  /** A `fragment` is where the world is reached, so nothing is refused there. */
  it("says nothing about the same line written in a fragment", () => {
    const source = program("fragment shouts(n) {", "  if n > 10 {", '    print "loud"', "  }", "}");

    expect(titles(source)).toEqual([]);
  });

  /**
   * Which body a line sits in is read by counting braces upward rather than by
   * taking the nearest `fn` above it: a `fn` whose `}` is behind the line is not
   * the body the line sits in, and a `fn` written as one expression opens no
   * body at all. Both lines below are at the top of a file, where a verb is
   * exactly what belongs, and the mistake in them is an argument nobody
   * bracketed, which is the explainer that has to answer.
   */
  it("says nothing about a verb written after a fn has closed", () => {
    const source = program("fn twice(n) {", "  return n * 2", "}", "print * 2");

    expect(titles(source)[0]).toContain("has to be bracketed");
  });

  it("says nothing about a verb under a fn written as one expression", () => {
    const source = program("fn twice(n) => n * 2", "print * 2");

    expect(titles(source)[0]).toContain("has to be bracketed");
  });
});
