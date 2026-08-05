import { createSeededRandom } from "@venn-lang/contracts";
import type { ActionContext } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { mathPlugin } from "./plugin.js";

const actions = mathPlugin.actions ?? [];
const values = mathPlugin.values ?? [];

/** Run one verb the way a program would, with a source of randomness bound. */
function run(name: string, ...args: unknown[]): unknown {
  const found = actions.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`math.${name} is not a verb`);
  const random = createSeededRandom({ seed: 1 });
  const ctx = { port: () => random } as unknown as ActionContext;
  return found.run(ctx, { args, params: {} });
}

function value(name: string): unknown {
  return values.find((candidate) => candidate.name === name)?.value;
}

describe("the constants", () => {
  it("are values, read without brackets", () => {
    expect(value("pi")).toBeCloseTo(Math.PI);
    expect(value("tau")).toBeCloseTo(Math.PI * 2);
    expect(value("e")).toBeCloseTo(Math.E);
  });

  it("say what they are, and what type they are", () => {
    for (const one of values) {
      expect(one.doc.length, one.name).toBeGreaterThan(10);
      expect(one.type, one.name).toEqual({ kind: "prim", name: "number" });
    }
  });
});

describe("the functions", () => {
  it("does trigonometry in radians", () => {
    expect(run("sin", 0)).toBe(0);
    expect(run("cos", 0)).toBe(1);
    expect(run("atan2", 1, 1)).toBeCloseTo(Math.PI / 4);
  });

  it("goes between radians and degrees, both ways", () => {
    expect(run("degrees", Math.PI)).toBeCloseTo(180);
    expect(run("radians", 180)).toBeCloseTo(Math.PI);
  });

  it("takes logarithms in the three bases anyone asks for", () => {
    expect(run("log", Math.E)).toBeCloseTo(1);
    expect(run("log2", 8)).toBeCloseTo(3);
    expect(run("log10", 1000)).toBeCloseTo(3);
  });

  it("measures the hypotenuse without squaring first", () => {
    expect(run("hypot", 3, 4)).toBe(5);
  });

  it("finds a common divisor and a common multiple", () => {
    expect(run("gcd", 12, 18)).toBe(6);
    expect(run("gcd", -12, 18)).toBe(6);
    expect(run("lcm", 4, 6)).toBe(12);
  });

  /** Nothing to divide, so nothing to have in common. */
  it("answers zero for a multiple of nothing", () => {
    expect(run("lcm", 0, 5)).toBe(0);
  });
});

describe("randomness", () => {
  it("comes from the run's own source, so it draws the same twice", () => {
    const first = run("random");
    const again = run("random");

    expect(first).toBe(again);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
  });

  it("stays inside the range it was given, both ends included", () => {
    for (let at = 0; at < 20; at += 1) {
      const found = run("randomInt", 1, 6) as number;

      expect(found).toBeGreaterThanOrEqual(1);
      expect(found).toBeLessThanOrEqual(6);
      expect(Number.isInteger(found)).toBe(true);
    }
  });

  /**
   * A range whose end is below its start is not a range. It answered with a
   * number outside both ends, which is a verb agreeing to something impossible.
   */
  it("refuses a range whose end is below its start", () => {
    expect(() => run("randomInt", 10, 1)).toThrow(/no range from 10 to 1/);
  });

  it("takes a range of one, which is a range", () => {
    expect(run("randomInt", 4, 4)).toBe(4);
  });

  /** Both ends default to zero, so a call with neither is the range [0, 0]. */
  it("gives zero when it is given neither end", () => {
    expect(run("randomInt")).toBe(0);
  });
});

describe("the questions a number cannot answer about itself", () => {
  /** It equals nothing, itself included, so asking has to be a verb. */
  it("finds the not-a-number that no comparison can find", () => {
    expect(run("isNaN", Number.NaN)).toBe(true);
    expect(run("isNaN", 1)).toBe(false);
  });

  it("says whether a number is a real one", () => {
    expect(run("isFinite", 1)).toBe(true);
    expect(run("isFinite", Number.POSITIVE_INFINITY)).toBe(false);
    expect(run("isFinite", Number.NaN)).toBe(false);
  });

  it("compares floats by how near they are, which is the only fair question", () => {
    expect(run("isClose", 0.1 + 0.2, 0.3)).toBe(true);
    expect(run("isClose", 1, 2)).toBe(false);
  });

  /** A fixed tolerance is wrong at both ends, so it scales unless one is given. */
  it("takes a tolerance when the caller has one in mind", () => {
    expect(run("isClose", 100, 101, 5)).toBe(true);
    expect(run("isClose", 100, 101, 0.5)).toBe(false);
  });

  /**
   * Which is what scaling buys: one apart is below what a float can even hold at
   * ten quadrillion, and is the whole difference between one and two.
   */
  it("takes a gap as close where the numbers are too large to tell apart", () => {
    expect(run("isClose", 1e16, 1e16 + 1)).toBe(true);
    expect(run("isClose", 1, 2)).toBe(false);
  });
});

describe("the rest of the arithmetic", () => {
  it("throws the whole part toward zero, unlike floor", () => {
    expect(run("trunc", -2.7)).toBe(-2);
    expect(run("cbrt", 27)).toBeCloseTo(3);
  });

  it("multiplies every whole number up to one", () => {
    expect(run("factorial", 5)).toBe(120);
    expect(run("factorial", 0)).toBe(1);
  });

  /** Below zero it has no meaning, and `NaN` was as much a lie as `1` would be. */
  it("refuses below zero rather than answering the not-a-number", () => {
    expect(() => run("factorial", -1)).toThrow("There is no answer to `math.factorial(-1)`.");
  });

  it("picks between two, which a list already does for many", () => {
    expect(run("min", 3, 7)).toBe(3);
    expect(run("max", 3, 7)).toBe(7);
  });
});

describe("what the namespace does not have", () => {
  /** A number answers these about itself, and one spelling is enough. */
  it("leaves what a number already has a member for alone", () => {
    const names = new Set(actions.map((action) => action.name));

    for (const member of ["abs", "floor", "ceil", "round", "sign", "sqrt", "pow", "clamp"]) {
      expect(names.has(member), member).toBe(false);
    }
  });

  it("types every verb it does have", () => {
    expect(actions.filter((action) => !action.signature).map((one) => one.name)).toEqual([]);
  });
});
