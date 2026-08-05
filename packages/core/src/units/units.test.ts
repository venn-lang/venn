import { describe, expect, it } from "vitest";
import { combine, parseNumber } from "./index.js";
import type { Duration, Instant } from "./unit.types.js";

const dur = (ms: number): Duration => ({ kind: "duration", ms });

const at = (iso: string): Instant => ({ kind: "instant", epochMs: Date.parse(iso), iso });

describe("parseNumber", () => {
  it("parses plain and unit-typed numbers", () => {
    expect(parseNumber("200")).toBe(200);
    expect(parseNumber("300ms")).toEqual(dur(300));
    expect(parseNumber("1.5s")).toEqual(dur(1500));
    expect(parseNumber("2mb")).toEqual({ kind: "size", bytes: 2097152 });
    expect(parseNumber("50%")).toEqual({ kind: "percent", ratio: 0.5 });
  });
});

describe("combine", () => {
  it("300ms + 1s is a valid 1300ms duration", () => {
    expect(combine({ op: "+", left: dur(300), right: dur(1000) })).toEqual({
      ok: true,
      value: dur(1300),
    });
  });

  it("300ms + 2mb is a unit mismatch (VN3012 data)", () => {
    const result = combine({ op: "+", left: dur(300), right: { kind: "size", bytes: 2 } });
    expect(result.ok).toBe(false);
  });

  it("compares same-unit values", () => {
    expect(combine({ op: "<", left: dur(300), right: dur(500) })).toEqual({
      ok: true,
      value: true,
    });
  });

  it("comparing a duration with a size is a mismatch", () => {
    const result = combine({ op: "<", left: dur(300), right: { kind: "size", bytes: 2 } });
    expect(result.ok).toBe(false);
  });

  it("scalar equality works for status codes", () => {
    expect(combine({ op: "==", left: 200, right: 200 })).toEqual({ ok: true, value: true });
  });

  it("scales a duration by a scalar", () => {
    expect(combine({ op: "*", left: dur(2000), right: 3 })).toEqual({ ok: true, value: dur(6000) });
  });
});

describe("moments", () => {
  const began = at("2026-01-01T00:00:00.000Z");
  const ended = at("2026-01-02T00:00:00.000Z");

  it("a moment minus a moment is how long there was between them", () => {
    expect(combine({ op: "-", left: ended, right: began })).toEqual({
      ok: true,
      value: dur(86_400_000),
    });
  });

  it("counts backwards when the later moment is on the left", () => {
    expect(combine({ op: "-", left: began, right: ended })).toEqual({
      ok: true,
      value: dur(-86_400_000),
    });
  });

  it("a moment and a length of time give a moment, either way round", () => {
    expect(combine({ op: "+", left: began, right: dur(86_400_000) })).toEqual({
      ok: true,
      value: ended,
    });
    expect(combine({ op: "+", left: dur(86_400_000), right: began })).toEqual({
      ok: true,
      value: ended,
    });
    expect(combine({ op: "-", left: ended, right: dur(86_400_000) })).toEqual({
      ok: true,
      value: began,
    });
  });

  it("orders two moments", () => {
    expect(combine({ op: "<", left: began, right: ended })).toEqual({ ok: true, value: true });
    expect(combine({ op: "==", left: began, right: at("2026-01-01T00:00:00.000Z") })).toEqual({
      ok: true,
      value: true,
    });
  });

  it("refuses a moment with a plain number, and everything else with one", () => {
    expect(combine({ op: "+", left: began, right: 1 }).ok).toBe(false);
    expect(combine({ op: "*", left: began, right: 2 }).ok).toBe(false);
    expect(combine({ op: "/", left: ended, right: began }).ok).toBe(false);
    expect(combine({ op: "+", left: began, right: ended }).ok).toBe(false);
    expect(combine({ op: "-", left: dur(1000), right: began }).ok).toBe(false);
    expect(combine({ op: "+", left: began, right: { kind: "size", bytes: 2 } }).ok).toBe(false);
  });

  it("names both sides when it refuses", () => {
    const result = combine({ op: "*", left: began, right: 2 });
    expect("mismatch" in result && result.mismatch).toEqual({
      op: "*",
      left: "instant",
      right: "scalar",
    });
  });
});
