// biome-ignore-all lint/suspicious/noTemplateCurlyInString: these strings are Venn source under test, where ${…} is the language's own interpolation.
import { describe, expect, it } from "vitest";
import { scanInterpolations } from "./scan-interpolations.js";

describe("scanInterpolations", () => {
  it("finds nothing in a plain string", () => {
    expect(scanInterpolations("just text")).toEqual([]);
  });

  it("locates a placeholder precisely enough to highlight it", () => {
    const text = "a ${env.URL} b";

    expect(scanInterpolations(text)).toEqual([
      { start: 2, end: 12, source: "env.URL", sourceStart: 4 },
    ]);
    expect(text.slice(2, 12)).toBe("${env.URL}");
  });

  it("reports the source without its surrounding blanks, but keeps its offset", () => {
    const text = "${  env.URL  }";
    const [slot] = scanInterpolations(text);

    expect(slot?.source).toBe("env.URL");
    expect(text.slice(slot?.sourceStart ?? 0, (slot?.sourceStart ?? 0) + 7)).toBe("env.URL");
  });

  it("finds every placeholder in a URL built from several", () => {
    const slots = scanInterpolations("${env.URL}/realms/${env.REALM}/token");

    expect(slots.map((slot) => slot.source)).toEqual(["env.URL", "env.REALM"]);
  });

  it("counts nesting, so a map literal inside a placeholder does not end it early", () => {
    const slots = scanInterpolations("${ {a: 1}.a }");

    expect(slots.map((slot) => slot.source)).toEqual(["{a: 1}.a"]);
  });

  it("ignores an unterminated placeholder rather than guessing where it ends", () => {
    expect(scanInterpolations("${env.URL")).toEqual([]);
  });
});
