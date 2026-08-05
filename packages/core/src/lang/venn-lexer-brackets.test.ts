import { describe, expect, it } from "vitest";
import { parse, SEMICOLON_IN_BRACKETS } from "../parse/index.js";

/**
 * A newline is dropped inside `(` and `[`, so one nobody closed runs the rest
 * of the file into a single statement: every other mistake in it stops being
 * reportable, and what came out was one line about the end of the file.
 */
describe("a bracket nobody closed", () => {
  it("says which bracket it was, where it was opened", () => {
    const found = parse("print (1\nprint 2\nprint 3\n").problems;

    expect(found).toHaveLength(1);
    expect(found[0]?.code).toBe("VN1001");
    expect(found[0]?.title).toBe(
      "This `(` is never closed, so the rest of the file is read as part of it.",
    );
    expect(found[0]?.span.line).toBe(1);
    expect(found[0]?.span.column).toBe(7);
  });

  it("says the same for a list nobody closed", () => {
    expect(parse("print a[1\n").problems[0]?.title).toContain("`[` is never closed");
  });

  it("leaves a file whose brackets all close alone", () => {
    expect(parse("print (1)\nprint [2]\n").problems).toEqual([]);
  });
});

/** A closer that closes the wrong bracket: the file, the character, the fix. */
const MISMATCHED = [
  {
    at: "1:8",
    closer: "}",
    earned: "print(1}\nprint 2\n",
    fixed: "print(1)\nprint 2\n",
    what: "a `}` where a `)` was wanted",
  },
  {
    at: "1:11",
    closer: "]",
    earned: "let a = (1]\nprint a\n",
    fixed: "let a = (1)\nprint a\n",
    what: "a `]` where a `)` was wanted",
  },
];

/**
 * The pop fired on any closer at all, so a stray `}` discharged an open `(` and
 * took away the one error this walk exists to raise.
 *
 * It is raised, and on a line with one bracket it is the only report. The
 * bracket is left standing, so a later closer of its own still meets it, but
 * the sentence about a bracket nobody closed says the rest of the file is read
 * as part of it, and that is the one thing a report pointing at the closer
 * disproves. Writing the character it asks for closes the bracket as well.
 */
describe("a closer that closes the wrong bracket", () => {
  it.each(MISMATCHED)("points at itself and at nothing else, $what", (row) => {
    const found = parse(row.earned).problems;

    expect(found.map((one) => one.title)).toEqual([
      `This \`${row.closer}\` does not close the \`(\` that is still open. Write \`)\` here.`,
    ]);
    expect(`${found[0]?.code} ${found[0]?.span.line}:${found[0]?.span.column}`).toBe(
      `VN1001 ${row.at}`,
    );
    expect(parse(row.fixed).problems).toEqual([]);
  });

  it("still says the bracket nobody closed is unclosed, when nobody closed it", () => {
    const found = parse("print(1\nprint 2\n").problems;

    expect(found.map((one) => one.title)).toEqual([
      "This `(` is never closed, so the rest of the file is read as part of it.",
    ]);
  });

  it("leaves an outer bracket its own report, since the closer named the inner one", () => {
    expect(parse("print([1)\nprint 2\n").problems.map((one) => one.title)).toEqual([
      "This `(` is never closed, so the rest of the file is read as part of it.",
      "This `)` does not close the `[` that is still open. Write `]` here.",
    ]);
  });

  it("still discharges a bracket its own closer meets, innermost first", () => {
    expect(parse("print (1)\nprint [2]\nprint([1, 2])\n").problems).toEqual([]);
  });
});

/** A `;` between two items: what it earns, where, and the line that fixes it. */
const SEPARATING = [
  { at: "1:14", earned: "const xs = [1; 2]\n", fixed: "const xs = [1, 2]\n", what: "a list" },
  { at: "1:8", earned: "print(1; 2)\n", fixed: "print(1, 2)\n", what: "an argument list" },
];
/** A `;` with the closer next: the closer, the line, and the line that fixes it. */
const SEPARATES_NOTHING = [
  { earned: "const xs = [1;]\n", end: "]", fixed: "const xs = [1]\n" },
  { earned: "print(1;)\n", end: ")", fixed: "print(1)\n" },
];

/**
 * Two mistakes wore one sentence until the fix was applied to the line that
 * earned it: a comma is right only when an item follows, and an argument list
 * refuses a trailing one, so `print(1;)` was told to write `print(1,)`.
 */
describe("a `;` written inside `( )` or `[ ]`", () => {
  it.each(SEPARATING)("wants a comma between two items in $what", ({ earned, at, fixed }) => {
    const found = parse(earned).problems;
    expect(found[0]?.title).toBe(SEMICOLON_IN_BRACKETS);
    expect(`${found[0]?.span.line}:${found[0]?.span.column}`).toBe(at);
    expect(parse(fixed).problems).toEqual([]);
  });
  it.each(SEPARATES_NOTHING)("tells one before $end to go", ({ earned, end, fixed }) => {
    const said = `Nothing follows this \`;\` before the \`${end}\`, so it separates nothing.`;
    expect(parse(earned).problems.map((one) => one.title)).toEqual([`${said} Remove it.`]);
    expect(parse(fixed).problems).toEqual([]);
  });
});
