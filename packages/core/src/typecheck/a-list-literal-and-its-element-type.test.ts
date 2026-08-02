import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

const NEWLINE = String.fromCharCode(10);
const ROW = "type Row = { who: string, marks: map<number> }";

/** Every problem a source reports, as `CODE title`. */
function said(...lines: string[]): string[] {
  const source = lines.join(NEWLINE);
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => `${problem.code} ${problem.title}`);
}

/**
 * A list literal written where its element type was already declared.
 *
 * Inference works outwards, so a list had to say what its items were before the
 * annotation was ever read: the first item became the rule and every later one
 * was measured against its neighbour. A list of records whose fields differ row
 * by row is the ordinary shape of configuration and of test data, and it was
 * refused for disagreeing with itself about a type nobody had written down.
 */
describe("a list literal whose element type was declared", () => {
  it("takes items whose fields differ, since the annotation says they may", () => {
    expect(said("const rows: list<map<number>> = [{ x: 1, y: 2 }, { x: 3 }]")).toEqual([]);
  });

  it("takes them under a name the file declared", () => {
    const rows = 'const rows: list<Row> = [{ who: "a", marks: { x: 1 } },';
    const rest = '                         { who: "b", marks: { x: 1, y: 2 } }]';

    expect(said(ROW, rows, rest)).toEqual([]);
  });

  it("still refuses an item the declared type does not allow", () => {
    expect(said('const xs: list<number> = [1, "two", 3]')).toEqual([
      "VN3010 Type mismatch: expected number, found string.",
    ]);
  });

  /** Once, at the item. The list itself agrees with the annotation by then. */
  it("says it once, where the item is written", () => {
    expect(said('const xs: list<number> = [1, "two", 3]')).toHaveLength(1);
  });

  it("reads the annotation through a field of a shape", () => {
    const term = "type Term = { name: string, rows: list<Row> }";
    const rows = 'const t: Term = { name: "spring", rows: [{ who: "a", marks: { x: 1 } },';
    const rest = '                                         { who: "b", marks: { y: 2 } }] }';

    expect(said(ROW, term, rows, rest)).toEqual([]);
  });

  it("reads it off the parameter a call hands the list to", () => {
    const count = "fn count(rows: list<Row>) -> number => rows.len";
    const call = 'const n = count([{ who: "a", marks: { x: 1 } }, { who: "b", marks: {} }])';

    expect(said(ROW, count, call)).toEqual([]);
  });

  /** And still refuses an argument that is not one of those, at the item. */
  it("refuses an item a parameter would not take", () => {
    const count = "fn count(rows: list<Row>) -> number => rows.len";
    const call = "const n = count([{ who: 1, marks: {} }])";

    expect(said(ROW, count, call)).toHaveLength(1);
  });

  it("reaches a list inside a list", () => {
    expect(said("const grid: list<list<map<number>>> = [[{ x: 1 }], [{ y: 2 }]]")).toEqual([]);
  });

  /** A shape asked for reaches the fields, and a `...` still pours into them. */
  it("leaves a map literal pouring where the shape was declared", () => {
    const base = 'const base = { who: "a" }';
    const one = "const one: Row = { ...base, marks: { x: 1 } }";

    expect(said(ROW, base, one)).toEqual([]);
  });

  it("reads it off the result a `fn` declared, written as one expression", () => {
    const head = 'fn rows() -> list<Row> => [{ who: "ada", marks: { homework: 95 } },';
    const rest = '                           { who: "grace", marks: { homework: 78, final: 85 } }]';

    expect(said(ROW, head, rest)).toEqual([]);
  });

  it("reads it off the result of a block body's return", () => {
    const head = "fn rows() -> list<Row> {";
    const one = '  return [{ who: "ada", marks: { homework: 95 } },';
    const two = '          { who: "grace", marks: { homework: 78, final: 85 } }]';

    expect(said(ROW, head, one, two, "}")).toEqual([]);
  });

  it("reads it off the result on the expression a block body ends with", () => {
    const head = "fn rows() -> list<Row> {";
    const one = '  [{ who: "ada", marks: { homework: 95 } },';
    const two = '   { who: "grace", marks: { homework: 78, final: 85 } }]';

    expect(said(ROW, head, one, two, "}")).toEqual([]);
  });

  /** And still refuses a row the declared result does not allow, at the row. */
  it("refuses a row the declared result would not take", () => {
    const decl = "fn rows() -> list<Row> => [{ who: 1, marks: {} }]";

    expect(said(ROW, decl)).toHaveLength(1);
  });

  it("pours a list of the same element in", () => {
    const rows = 'const rows: list<Row> = [{ who: "a", marks: { x: 1 } }]';
    const more = 'const more: list<Row> = [{ who: "b", marks: {} }, ...rows]';

    expect(said(ROW, rows, more)).toEqual([]);
  });
});

/**
 * With nothing declared there is nothing to check against but the items
 * themselves, and that stays: the first item is the rule, and the reader is told
 * once which item broke it rather than once per item that is not the first.
 */
describe("a list literal nobody declared anything about", () => {
  it("is still measured against its first item", () => {
    expect(said('const xs = [1, "a"]')[0]).toContain("expected number, found string");
  });

  it("is one mistake and not two", () => {
    expect(said('const xs = [1, "a"]')).toHaveLength(1);
  });
});

/** A value that is not a list at all is a mismatch about the whole value. */
describe("what the binding still checks", () => {
  it("refuses something that is not a list", () => {
    expect(said("const xs: list<number> = 5")[0]).toContain("expected list<number>, found number");
  });

  it("refuses a list of the wrong thing where every item agrees", () => {
    expect(said('const xs: list<number> = ["a", "b"]')).toHaveLength(2);
  });
});
