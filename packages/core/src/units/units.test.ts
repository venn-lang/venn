import { describe, expect, it } from "vitest";
import { combine, parseNumber } from "./index.js";
import type { Duration } from "./unit.types.js";

const dur = (ms: number): Duration => ({ kind: "duration", ms });

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
