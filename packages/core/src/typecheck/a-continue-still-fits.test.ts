import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

/** Type-check a program and return `CODE title` for each problem. */
function said(...lines: string[]): string[] {
  const { ast, problems } = parse(lines.join("\n"));
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => `${problem.code} ${problem.title}`);
}

/** The help line, for the one case whose fix is a spelling. */
function helped(...lines: string[]): (string | undefined)[] {
  return checkTypes(parse(lines.join("\n")).ast).problems.map((problem) => problem.help);
}

describe("a continue that changes the shape of the state", () => {
  it("names the field it drops", () => {
    const found = said("loop s = { a: 0, b: 9 } {", "  continue { a: 1 }", "}");

    expect(found).toEqual(['VN3027 This `continue` drops "b" from the state the loop carries.']);
  });

  it("names every field it drops, not only the first", () => {
    const found = said("loop s = { a: 0, b: 9, c: 1 } {", "  continue { a: 1 }", "}");

    expect(found[0]).toContain('drops "b" and "c"');
  });

  it("offers the spread that keeps the rest", () => {
    expect(helped("loop s = { a: 0, b: 9 } {", "  continue { a: 1 }", "}")).toEqual([
      "Spread the rest of it: `continue { ...s, … }`.",
    ]);
  });
});

describe("a continue that still fits", () => {
  it("says nothing when the whole shape is carried through", () => {
    expect(said("loop s = { a: 0, b: 9 } {", "  continue { ...s, a: s.a + 1 }", "}")).toEqual([]);
  });

  it("says nothing about the common form, which is not a map at all", () => {
    expect(said("loop n = 0 {", "  if n > 2 { break }", "  continue n + 1", "}")).toEqual([]);
  });

  it("says nothing about a bare continue, which carries what it had", () => {
    expect(said("loop s = { a: 0, b: 9 } {", "  continue", "}")).toEqual([]);
  });

  /** A `break` leaves, so what the loop carries is no longer its business. */
  it("says nothing about a break", () => {
    expect(said("loop s = { a: 0, b: 9 } {", "  break", "}")).toEqual([]);
  });
});

describe("several continues on different branches", () => {
  const HEAD = "loop s = { lo: 0, hi: 10, n: 0 } {";

  it("accepts every branch that carries the whole state", () => {
    const found = said(
      HEAD,
      "  if s.lo > 1 { continue { ...s, lo: s.lo + 1 } }",
      "  continue { ...s, hi: s.hi - 1 }",
      "}",
    );

    expect(found).toEqual([]);
  });

  it("reports only the branch that drops one", () => {
    const found = said(
      HEAD,
      "  if s.lo > 1 { continue { ...s, lo: s.lo + 1 } }",
      "  continue { lo: s.lo, hi: s.hi }",
      "}",
    );

    expect(found).toEqual(['VN3027 This `continue` drops "n" from the state the loop carries.']);
  });
});

describe("a value the loop has nowhere to put", () => {
  it("reports a continue in a repeat, which starts its next pass with nothing", () => {
    const found = said("loop n = 1 {", "  repeat 1 { continue 99 }", "  break", "}");

    expect(found).toEqual([
      "VN3027 Nothing carries this value to the next pass, so it is dropped.",
    ]);
  });

  /**
   * The way out has to fit the program that earned it. This `continue` sits in
   * a `repeat` inside a `loop` that already has a state, so "give the loop a
   * state" would describe a program the reader has already written.
   */
  it("names what is between the continue and the loop, not the loop", () => {
    const found = helped("loop n = 1 {", "  repeat 1 { continue 99 }", "  break", "}");

    expect(found[0]).toContain("start each pass with nothing");
    expect(found[0]).not.toContain("Only a `loop` with a state");
  });

  it("reports a continue in a forEach for the same reason", () => {
    const found = said("loop n = 1 {", "  forEach x in [1] { continue x }", "  break", "}");

    expect(found[0]).toContain("Nothing carries this value");
  });

  it("tells a loop with no state to get one, which is the case that fits", () => {
    expect(said("loop {", "  continue 1", "}")[0]).toContain("Nothing carries this value");
    expect(helped("loop {", "  continue 1", "}")[0]).toContain("Only a `loop` with a state");
  });

  it("says nothing about a bare continue anywhere", () => {
    expect(said("repeat 2 {", "  continue", "}")).toEqual([]);
  });

  /**
   * The help offers two ways out of the `repeat` case. A help line is a claim,
   * so both are applied to the line that earned them and read back: neither may
   * leave a diagnostic of its own behind.
   */
  it("means what it says: both repairs of the repeat case check clean", () => {
    expect(said("loop n = 1 {", "  repeat 1 { continue }", "  break", "}")).toEqual([]);
    expect(said("loop n = 1 {", "  continue 99", "}")).toEqual([]);
  });

  it("means what it says: the repair of the stateless case checks clean", () => {
    expect(said("loop n = 0 {", "  if n > 2 { break }", "  continue n + 1", "}")).toEqual([]);
  });
});

describe("what the rule will not claim", () => {
  /** Two types clashing is a clash, and naming them is the whole explanation. */
  it("leaves a plain clash on the plain code", () => {
    expect(said("loop n = 0 {", '  continue "x"', "}")[0]).toContain("VN3010");
  });
});
