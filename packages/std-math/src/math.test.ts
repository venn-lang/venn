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
