import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

const NEWLINE = String.fromCharCode(10);
const LIST = 'const asked = ["a", "b"]';
const MAP = "const one = { id: 1 }";

/** Every problem a source reports, as `CODE title`. */
function said(...lines: string[]): string[] {
  const source = lines.join(NEWLINE);
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => `${problem.code} ${problem.title}`);
}

/** The help under the first problem, which is where the matcher is named. */
function helped(...lines: string[]): string | undefined {
  return checkTypes(parse(lines.join(NEWLINE)).ast).problems[0]?.help;
}

/**
 * `==` between two lists, or between two maps.
 *
 * The operator asks whether the two are the same value, so two lists holding the
 * same items are never equal by it. Nothing said so, and inside an `expect` the
 * line reads as an assertion that holds while the diff it prints explains none
 * of it. The matcher `equals` is the structural comparison.
 */
describe("comparing two lists", () => {
  it("is reported where it is written", () => {
    expect(said(LIST, 'const same = asked == ["a", "b"]')[0]).toContain("VN5006");
  });

  it("says the comparison is by identity", () => {
    expect(said(LIST, 'const same = asked == ["a", "b"]')[0]).toContain(
      "compares two lists by identity",
    );
  });

  it("names the matcher that was meant", () => {
    expect(helped(LIST, 'const same = asked == ["a", "b"]')).toContain("`equals`");
  });

  it("reports `!=` the same way", () => {
    expect(said(LIST, 'const other = asked != ["a", "b"]')[0]).toContain("VN5006");
  });

  it("reports it once", () => {
    expect(said(LIST, 'const same = asked == ["a", "b"]')).toHaveLength(1);
  });

  it("reads two names as readily as a name and a literal", () => {
    expect(said(LIST, 'const also = ["a", "b"]', "const same = asked == also")[0]).toContain(
      "VN5006",
    );
  });

  /** Where it costs the most: the line reads as an assertion, and never holds. */
  it("is reported inside an `expect`", () => {
    const lines = [
      'flow "names come back" {',
      '  const answer = ["snorlax", "pikachu"]',
      '  expect answer == ["snorlax", "pikachu"]',
      "}",
    ];

    expect(said(...lines)[0]).toContain("VN5006");
  });
});

describe("comparing two maps", () => {
  it("is reported the same way", () => {
    expect(said(MAP, "const same = one == { id: 1 }")[0]).toContain("VN5006");
  });

  it("says which of the two it is", () => {
    expect(said(MAP, "const same = one == { id: 1 }")[0]).toContain(
      "compares two maps by identity",
    );
  });
});

/**
 * The ordinary comparisons, which are the reason the operator exists. Above all
 * `x == null`: nothing that may be nothing is a list or a map, so the guard
 * every program is written with never reaches this at all.
 */
describe("what it leaves alone", () => {
  const BOX = ["type Box = { rows: list<number> | null }", "const b: Box = { rows: null }"];

  it("says nothing about a guard against nothing", () => {
    expect(said(...BOX, "if b.rows == null {", '  print "empty"', "}")).toEqual([]);
  });

  it("says nothing where the one side may be nothing", () => {
    expect(said(...BOX, "const same = b.rows == [1, 2]")).toEqual([]);
  });

  it("says nothing about two values compared by what they are", () => {
    expect(said('const same = "a" == "b"', "const also = 1 != 2")).toEqual([]);
  });

  it("says nothing where one side is a list and the other is not", () => {
    expect(said(LIST, "const n = 2", "const same = asked == n")).toHaveLength(0);
  });

  it("says nothing about values whose types nobody knows", () => {
    expect(said("fn holds(a, b) -> bool => a == b")).toEqual([]);
  });
});
