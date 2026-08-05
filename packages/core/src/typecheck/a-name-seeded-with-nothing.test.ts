/**
 * `let a = []` widens and `let b = null` did not.
 *
 * Nothing said which was which, and `expected null, found number` named a type
 * nobody would ever declare as the thing that was wanted.
 *
 * That one rule is why a program could not report why its input was malformed.
 * `try`/`catch` is a statement, so the parsed value cannot leave the block, and
 * the bridge every language writes for it is a `let` above the `try` for the body
 * to assign into. Seeded with `null` the bridge was refused; what the survey
 * author shipped instead was parsing the document twice, once for the value and
 * once for the message.
 */

import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

const NEWLINE = String.fromCharCode(10);

/** Every problem a source reports, as `CODE title`. */
function said(...lines: string[]): string[] {
  const { ast, problems } = parse(lines.join(NEWLINE));
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => `${problem.code} ${problem.title}`);
}

const BRIDGE = ["let doc = null", "try {", "  doc = { items: 1 }", "} catch e {", "}"];

/** The write is what teaches the name, and the nothing stays beside what it taught. */
describe("a let that starts out holding nothing", () => {
  it("takes what is written into it", () => {
    expect(said("let b = null", "b = 3")).toEqual([]);
  });

  it("holds the nothing and the value afterwards", () => {
    expect(said("let b = null", "b = 3", "let s: string = b")).toEqual([
      "VN3010 Type mismatch: expected string, found number | null.",
    ]);
  });
});

/** A second write of another type is a clash, exactly as it is for `[]`. */
describe("a name that already learned what it holds", () => {
  it("does not go on widening for ever", () => {
    expect(said("let b = null", "b = 3", 'b = "x"')).toEqual([
      "VN3010 Type mismatch: expected number | null, found string.",
    ]);
  });
});

/**
 * The point of the whole rule. The write is inside a block, every block runs in a
 * child scope, and the run writes through to the outer name, so the checker has
 * to as well or the bridge is refused one line further down than before.
 */
describe("the bridge across a try", () => {
  it("keeps what a write inside the block taught it", () => {
    expect(
      said("let doc = null", "try {", "  doc = 1", "} catch e {", "}", "let n: number = doc"),
    ).toEqual(["VN3010 Type mismatch: expected number, found number | null."]);
  });

  it("asks for a guard before a member is read through it", () => {
    expect(said(...BRIDGE, "print doc.items")[0]).toContain("VN3025");
  });

  it("reads clean on the far side of the guard", () => {
    expect(said(...BRIDGE, "if doc != null {", "  print doc.items", "}")).toEqual([]);
  });
});

/** Nothing was ever written, so the nothing is all there is, and it says so. */
describe("a name nothing was written into", () => {
  it("still reports a member read", () => {
    expect(said("let b = null", "print b.foo")).toEqual(['VN3010 Type null has no member "foo".']);
  });
});

/**
 * `const` keeping what it was given is the whole of what `const` is for, and an
 * annotation the checker parses and never enforces is worse than no annotation.
 */
describe("what does not widen", () => {
  it("refuses a write to a const", () => {
    expect(said("const b = null", "b = 3")).toEqual([
      "VN3010 Type mismatch: expected null, found number.",
    ]);
  });

  it("refuses a write the annotation does not allow", () => {
    expect(said("let b: null = null", "b = 3")).toEqual([
      "VN3010 Type mismatch: expected null, found number.",
    ]);
  });
});

/**
 * `{}` is a different rule, and deliberately. A name holding nothing is empty;
 * `{}` is a value with a shape, and the shape is "no keys". The language already
 * says so where it bites, and says the way out with it: the help under a write to
 * a `{}` names `let stats: map<number> = {}`.
 */
describe("the empty map, which is not the same hole", () => {
  it("keeps its own rule", () => {
    expect(said("let m = {}", "m = { a: 1 }")).toEqual([
      "VN3010 Type mismatch: expected {}, found { a: number }.",
    ]);
  });
});
