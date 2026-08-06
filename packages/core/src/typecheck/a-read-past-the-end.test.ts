/**
 * A read by position is partial, and the checker used to call it total.
 *
 * `["a"][5]` is `null` at run time. The checker typed it `string`, so the one
 * correct way to bounds-check a read was refused: `if raw == null` tested a value
 * the checker believed could never be nothing, which is VN3020, which is an
 * error, which means the program did not run at all.
 *
 * And because the guard could not be written, the failure was silent. A CLI
 * called with a flag and no value read `null` for the value, `NaN` for its
 * number, took `NaN` items, and printed a plausible wrong report with exit 0.
 */

import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";
import { PAST_THE_NOTHING } from "./nothing-help.js";

const NEWLINE = String.fromCharCode(10);

/** Every problem a source reports, as `CODE title`. */
function said(...lines: string[]): string[] {
  const { ast, problems } = parse(lines.join(NEWLINE));
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => `${problem.code} ${problem.title}`);
}

/** The help under the first problem, which is where the way out is written. */
function helped(...lines: string[]): string | undefined {
  return checkTypes(parse(lines.join(NEWLINE)).ast).problems[0]?.help;
}

/** An alias for `said`, where the test is about a program standing rather than reporting. */
const problems = said;

const XS = 'let xs = ["a"]';
const OF_XS5 = 'VN3025 xs[5] may be nothing here, so "len" cannot be read from it.';
const OF_RAW = 'VN3025 raw may be nothing here, so "len" cannot be read from it.';

/** The branch the checker used to delete, and the scope on the far side of it. */
describe("the guard against nothing", () => {
  it("compiles, where it was refused as a branch that never runs", () => {
    const guard = [XS, "let raw = xs[5]", "if raw == null {", '  print "missing"', "}"];

    expect(said(...guard)).toEqual([]);
  });

  it("leaves the read clean on the other side", () => {
    const guarded = [XS, "let raw = xs[5]", "if raw != null {", "  print raw.len", "}"];

    expect(said(...guarded)).toEqual([]);
  });
});

/** The read that has no guard, and what it is told, and where it is told it. */
describe("a member read through the nothing", () => {
  it("names the read as the source wrote it", () => {
    expect(said(XS, "print xs[5].len")[0]).toBe(OF_XS5);
  });

  it("names a binding by its name", () => {
    expect(said(XS, "let raw = xs[5]", "print raw.len")[0]).toBe(OF_RAW);
  });
});

/**
 * The way out has to fit the line that earned it, which the shared sentence does
 * for a name and does not for anything else: a guard narrows a NAME, so
 * `if xs[5] != null { print xs[5].len }` reports again, and an unbracketed
 * `xs[5] ?? "z".len` checks clean meaning `xs[5] ?? ("z".len)`. Both measured.
 */
describe("the way out it is given", () => {
  it("tells a name to take a stand-in where it stands", () => {
    expect(helped(XS, "let raw = xs[5]", "print raw.len")).toBe(PAST_THE_NOTHING);
  });

  it("tells anything else to bind it first, and brackets the stand-in", () => {
    const said = helped(XS, "print xs[5].len");

    expect(said).toContain("Bind it to a name");
    expect(said).toContain("`(xs[5] ?? …).len`");
  });
});

/** A spelling in a help line is a promise that the program compiles. */
describe("what the way out promises", () => {
  it("promises only spellings that compile", () => {
    expect(problems(XS, 'print (xs[5] ?? "z").len')).toEqual([]);
    expect(problems(XS, "let raw = xs[5]", "if raw != null {", "  print raw.len", "}")).toEqual([]);
  });
});

/** Every receiver a position reads into carries it, and only the reads do. */
describe("what carries the nothing", () => {
  it("carries it on a character", () => {
    expect(said('let word = "abc"', "print word[9].len")[0]).toContain("VN3025");
  });

  /** `args[i + 1]` is how a flag written without its value arrives. */
  it("carries it under a key the run works out", () => {
    expect(said(XS, "let at = 1", "print xs[at].len")[0]).toContain("VN3025");
  });

  /** A write puts a value at a position rather than finding out what is there. */
  it("says nothing about a write", () => {
    expect(said("let xs = [1, 2]", "xs[0] = 5")).toEqual([]);
  });
});

/**
 * The ways out, both of them spellings this repository runs rather than claims,
 * and the question a `?.` is asking rather than telling.
 */
describe("the ways past it", () => {
  it("takes a stand-in", () => {
    expect(said(XS, 'print (xs[5] ?? "z").len')).toEqual([]);
  });

  it("takes an asking read", () => {
    expect(said(XS, "print xs[5]?.len")).toEqual([]);
  });
});

/**
 * Where the rule stops, which is where the knowledge stops. A guard forced on a
 * value the checker cannot see is a guard on a working program.
 */
describe("what a position read stays quiet about", () => {
  it("still solves the element of an empty list through a write", () => {
    expect(said("let xs = []", "xs[0] = 1", "let total: number = xs.sum")).toEqual([]);
  });
});

/**
 * A pair says which of its positions holds what, because `entries`, `zip` and
 * `pairwise` all know. There is no tuple here to write that down with, so the
 * list carries it beside the union every message still prints.
 */
describe("a position of a pair", () => {
  const PAIRS = ['let counts = ["a", "b"].countBy(w => w)', "let rows = counts.entries"];

  it("answers the key at 0 and the count at 1", () => {
    const both = ["let k: string = rows.first[0]", "let n: number = rows.first[1]"];

    expect(said(...PAIRS, ...both)).toEqual([]);
  });

  it("refuses the two of them the other way round", () => {
    expect(said(...PAIRS, "let n: number = rows.first[0]")[0]).toBe(
      "VN3010 Type mismatch: expected number, found string.",
    );
  });

  /** The pair knows its positions; the list of pairs still knows nothing of its length. */
  it("carries the nothing on the list the pairs are in", () => {
    expect(said(...PAIRS, "print rows[0][1]")[0]).toBe(
      "VN3025 rows[0] may be nothing here, so `[1]` cannot be read from it.",
    );
  });

  it("says nothing when the element is not known yet", () => {
    expect(said("let raw = [1].map(n => n)[0]", "print raw")).toEqual([]);
  });
});

/**
 * A union the reader wrote down is a promise about every position of that list,
 * and it is checked. The carve-out that let a pair through answered `dynamic`
 * for this one too, so a `number` held a string and the run printed it.
 */
describe("a union somebody declared", () => {
  const PEEK = [
    "type Cell = string | number",
    "fn peek(xs: list<Cell>) {",
    "  let n: number = xs[0]",
    "  return n",
    "}",
  ];

  it("is refused at a position", () => {
    expect(said(...PEEK, 'print peek(["a", 1])')[0]).toBe(
      "VN3010 Type mismatch: expected number, found Cell | null.",
    );
  });

  it("is refused by name, in the sentence it has always used", () => {
    const byName = [...PEEK.slice(0, 2), "  let n: number = xs.first", ...PEEK.slice(3)];

    expect(said(...byName)[0]).toBe("VN3010 Type mismatch: expected number, found Cell.");
  });
});

/**
 * One question, two spellings. `positionType` answers nothing for a receiver
 * that may be nothing, and the position spelling returned `dynamic` before
 * anything had asked about the nothing at all.
 */
describe("the nothing, whichever way the read was spelled", () => {
  const ROWS = "let rows = [[1, 2], [3, 4]]";

  it("reports a read by position where it reports one by name", () => {
    expect(said(ROWS, "print rows[9][0]")[0]).toBe(
      "VN3025 rows[9] may be nothing here, so `[0]` cannot be read from it.",
    );
    expect(said(ROWS, "print rows[9].len")[0]).toBe(
      'VN3025 rows[9] may be nothing here, so "len" cannot be read from it.',
    );
  });

  it("carries it through a string the same way", () => {
    expect(said('let s = ["ab"]', "print s[9][0]")[0]).toBe(
      "VN3025 s[9] may be nothing here, so `[0]` cannot be read from it.",
    );
  });

  it("brackets the stand-in, because `.0` is not a spelling", () => {
    expect(helped(ROWS, "print rows[9][0]")).toContain("`(rows[9] ?? …)[0]`");
  });

  it("promises only a way out that reports nothing", () => {
    const guarded = [ROWS, "let row = rows[9]", "if row != null {", "  print row[0]", "}"];

    expect(problems(ROWS, "print (rows[9] ?? [0])[0]")).toEqual([]);
    expect(problems(...guarded)).toEqual([]);
  });
});
