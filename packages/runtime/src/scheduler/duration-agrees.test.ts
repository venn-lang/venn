import { durationMs, parseNumber } from "@venn-lang/core";
import { Duration, unitBase } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";

/**
 * A duration is known in two places and may only ever be known one way.
 *
 * The compiler builds `30s` and the SDK reads it, and the SDK may never import
 * the compiler: a plugin package that did would drag the parser into every
 * `pnpm add`. So `packages/sdk/src/duration.ts` holds its own copy of the
 * ladder and of the shape, and this is the seam where the copy is held to the
 * original. The runtime is the one package that legitimately sees both.
 *
 * Before this existed, the SDK's `Duration` took a string or a number and
 * nothing else, so six option keys across three plugins refused the language's
 * own literal, and `mock.clock.advance(1h)` worked only because std-mock had
 * quietly unwrapped it first.
 */
const SUFFIXES = ["ms", "s", "m", "h"] as const;

/** What the acceptance side answers, from either package, in one word. */
function accepted(value: unknown): number | undefined {
  const result = Duration.safeParse(value);
  return result.success ? result.data : undefined;
}

describe("the SDK's Duration and the compiler's durations", () => {
  it("puts the same milliseconds behind every duration suffix", () => {
    for (const suffix of SUFFIXES) {
      const literal = parseNumber(`1${suffix}`);

      expect(accepted(literal), suffix).toBe(durationMs(literal));
    }
  });

  /** The ladder itself, so a wrong constant is named rather than merely felt. */
  it("climbs the ladder the compiler climbs", () => {
    const ladder = SUFFIXES.map((suffix) => accepted(parseNumber(`1${suffix}`)));

    expect(ladder).toEqual([1, 1000, 60_000, 3_600_000]);
  });

  it("accepts exactly what the compiler produces for a duration lexeme", () => {
    for (const raw of ["250ms", "1.5s", "2m", "1_000ms", "0h"]) {
      const literal = parseNumber(raw);

      expect(unitBase(literal, "duration"), raw).not.toBeUndefined();
      expect(accepted(literal), raw).toBe(durationMs(literal));
    }
  });

  /** A size and a percent are unit values too, and neither is a length of time. */
  it("takes no other unit the compiler produces", () => {
    for (const raw of ["2mb", "50%", "1kb"]) {
      const literal = parseNumber(raw);

      expect(accepted(literal), raw).toBeUndefined();
      expect(durationMs(literal), raw).toBeUndefined();
    }
  });

  /**
   * Recognition and acceptance are different questions, and the two packages
   * have to answer the second one identically. `1s / 0` is a duration to both
   * (so it prints `Infinityms` rather than opening a map), and a bound to
   * neither.
   */
  it("agrees value for value on what may be used as a bound", () => {
    const cases: unknown[] = [
      0,
      1500,
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      { kind: "duration", ms: 30_000 },
      { kind: "duration", ms: Number.NaN },
      { kind: "duration", ms: Number.POSITIVE_INFINITY },
      { kind: "duration" },
      { kind: "duration", ms: "30" },
      { kind: "size", bytes: 4 },
      { kind: "duration", label: "x" },
      "30s",
      "soon",
      null,
      undefined,
      [],
    ];

    for (const value of cases) {
      const said = JSON.stringify(value) ?? String(value);
      // A string is the one thing the schema takes and the compiler's unwrapper
      // does not: `"30s"` is text a plugin author writes, never a value a flow
      // evaluated. Everywhere else the two must answer the same.
      const expected = typeof value === "string" ? accepted(value) : durationMs(value);

      expect(accepted(value), said).toBe(expected);
    }
  });

  it("takes the text form only where the text is a duration", () => {
    expect(accepted("30s")).toBe(30_000);
    expect(accepted("2m")).toBe(120_000);
    expect(accepted("30")).toBeUndefined();
    expect(accepted("30d")).toBeUndefined();
  });
});
