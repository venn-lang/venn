import { describe, expect, it } from "vitest";
import type { EvalEnv } from "../expr/eval-env.types.js";
import { interpolateText } from "./interpolate-text.js";

/** A scope holding exactly what a test puts in it. */
function holding(values: Record<string, unknown>): EvalEnv {
  return { lookup: (name) => values[name] };
}

/** A scope where reading anything at all goes wrong. */
const broken: EvalEnv = {
  lookup: () => {
    throw new Error("the scope is gone");
  },
};

describe("filling the placeholders in text", () => {
  it("hands back text with no placeholders untouched", () => {
    expect(interpolateText({ text: "plain", env: holding({}) })).toBe("plain");
  });

  it("fills one from the scope", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Venn interpolation source under test
    expect(interpolateText({ text: "add ${name}", env: holding({ name: "ana" }) })).toBe("add ana");
  });

  it("fills several, keeping the text between them", () => {
    const env = holding({ a: 1, b: 2 });

    // biome-ignore lint/suspicious/noTemplateCurlyInString: Venn interpolation source under test
    expect(interpolateText({ text: "${a} and ${b}!", env })).toBe("1 and 2!");
  });

  /**
   * How a value reads has to match what a string literal showing the same value
   * would print, which is why the rule lives in one place.
   */
  it("writes a duration, a size and a ratio the way a string does", () => {
    const env = holding({
      wait: { kind: "duration", ms: 300 },
      budget: { kind: "size", bytes: 2048 },
      rate: { kind: "percent", ratio: 0.999 },
    });

    // biome-ignore lint/suspicious/noTemplateCurlyInString: Venn interpolation source under test
    expect(interpolateText({ text: "${wait}", env })).toBe("300ms");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Venn interpolation source under test
    expect(interpolateText({ text: "${budget}", env })).toBe("2048b");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Venn interpolation source under test
    expect(interpolateText({ text: "${rate}", env })).toBe("99.9%");
  });

  it("leaves a gap where the value is absent", () => {
    const env = holding({ name: undefined, other: null });

    // biome-ignore lint/suspicious/noTemplateCurlyInString: Venn interpolation source under test
    expect(interpolateText({ text: "add ${name}${other}", env })).toBe("add ");
  });

  /**
   * A title is written before the step runs. Failing it over its own title, or
   * printing an exception where a name should be, is worse than a gap.
   */
  it("leaves a gap when reading the value goes wrong", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Venn interpolation source under test
    expect(interpolateText({ text: "add ${name}", env: broken })).toBe("add ");
  });

  it("leaves a gap where the placeholder is not an expression", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Venn interpolation source under test
    expect(interpolateText({ text: "add ${1 +}", env: holding({}) })).toBe("add ");
  });

  /** A placeholder can hold something still arriving, and the text waits for it. */
  it("waits for a value that has not arrived", async () => {
    const env = holding({ name: Promise.resolve("ana") });

    // biome-ignore lint/suspicious/noTemplateCurlyInString: Venn interpolation source under test
    const filled = interpolateText({ text: "add ${name}", env });

    expect(filled).toBeInstanceOf(Promise);
    expect(await filled).toBe("add ana");
  });

  it("waits once for several, and keeps them in order", async () => {
    const env = holding({ a: Promise.resolve(1), b: 2 });

    // biome-ignore lint/suspicious/noTemplateCurlyInString: Venn interpolation source under test
    expect(await interpolateText({ text: "${a} and ${b}", env })).toBe("1 and 2");
  });
});
