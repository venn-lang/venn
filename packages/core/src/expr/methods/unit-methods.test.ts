import { describe, expect, it } from "vitest";
import type { Document, LetStmt } from "../../generated/ast.js";
import { parse } from "../../parse/index.js";
import { evaluate } from "../evaluate.js";

function run(source: string): unknown {
  const { ast, problems } = parse(`const a = ${source}\n`);
  expect(problems).toEqual([]);
  const decl = (ast as Document).decls[0] as LetStmt;
  return evaluate(decl.value, { lookup: () => undefined });
}

describe("reading a unit back as a number", () => {
  it("converts a duration", () => {
    expect(run("1.5s.ms")).toBe(1500);
    expect(run("90s.minutes")).toBe(1.5);
    expect(run("2h.hours")).toBe(2);
  });

  it("converts a size", () => {
    expect(run("2mb.kb")).toBe(2048);
    expect(run("2048mb.gb")).toBe(2);
    expect(run("1kb.bytes")).toBe(1024);
  });

  it("converts a percent, and takes a share of a number", () => {
    expect(run("50%.ratio")).toBe(0.5);
    expect(run("50%.percent")).toBe(50);
    expect(run("12%.of(50)")).toBe(6);
  });

  it("converts what arithmetic produced", () => {
    expect(run("(300ms + 1s).seconds")).toBe(1.3);
  });

  // A unit is not a map: reading it as one would expose how it is stored, and
  // `kind`, `ms` and `bytes` would shadow the conversions that share their name.
  it("does not expose the shape it is stored in", () => {
    expect(run("300ms.kind")).toBeNull();
    expect(run("300ms.whatever")).toBeNull();
  });
});

// Symmetric with the table above: for every `X` a unit answers to, a number
// answers to `toX`. `2mb.kb` is 2048, and `2048.toKb` is that size again.
describe("reading a number as a unit", () => {
  it("makes a duration", () => {
    expect(run("1500.toMs")).toEqual({ kind: "duration", ms: 1500 });
    expect(run("1.5.toSeconds")).toEqual({ kind: "duration", ms: 1500 });
    expect(run("2.toHours")).toEqual({ kind: "duration", ms: 7200000 });
  });

  it("makes a size", () => {
    expect(run("2048.toKb")).toEqual({ kind: "size", bytes: 2097152 });
    expect(run("1.toGb")).toEqual({ kind: "size", bytes: 1073741824 });
  });

  it("makes a percent from either spelling", () => {
    expect(run("0.5.toRatio")).toEqual({ kind: "percent", ratio: 0.5 });
    expect(run("50.toPercent")).toEqual({ kind: "percent", ratio: 0.5 });
  });

  it("comes back to where it started", () => {
    expect(run("2mb.kb.toKb.mb")).toBe(2);
    expect(run("90s.minutes.toMinutes.seconds")).toBe(90);
  });

  it("produces a value arithmetic accepts as that unit", () => {
    expect(run("(1500.toMs + 1s).seconds")).toBe(2.5);
  });
});
