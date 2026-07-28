import { describe, expect, it } from "vitest";
import { parseNumber } from "./parse-number.js";

// `_` groups digits for the reader. The grammar only lets it sit between them,
// so the value is whatever it would have been without.
describe("digit separators", () => {
  it("reads a grouped integer as the number it spells", () => {
    expect(parseNumber("1_000_000")).toBe(1000000);
    expect(parseNumber("1_000")).toBe(parseNumber("1000"));
  });

  it("groups either side of the decimal point", () => {
    expect(parseNumber("9_999.999_9")).toBe(9999.9999);
  });

  it("groups a number that carries a unit", () => {
    expect(parseNumber("1_500ms")).toEqual({ kind: "duration", ms: 1500 });
    expect(parseNumber("2_048kb")).toEqual({ kind: "size", bytes: 2097152 });
  });
});
