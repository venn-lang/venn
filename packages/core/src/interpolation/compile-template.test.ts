// biome-ignore-all lint/suspicious/noTemplateCurlyInString: these strings are Venn source under test, where ${…} is the language's own interpolation.
import { describe, expect, it } from "vitest";
import { compileTemplate } from "./compile-template.js";

describe("compileTemplate", () => {
  it("splits the text around each placeholder", () => {
    const { chunks, holes } = compileTemplate("a ${x} b ${y} c");

    expect(chunks).toEqual(["a ", " b ", " c"]);
    expect(holes.map((hole) => hole.source)).toEqual(["x", "y"]);
  });

  // One more chunk than holes, always, so joining them can never drop text.
  it("keeps a chunk on each side, even when a placeholder is at an edge", () => {
    const { chunks, holes } = compileTemplate("${only}");

    expect(chunks).toEqual(["", ""]);
    expect(holes).toHaveLength(1);
  });

  it("parses each placeholder into an expression", () => {
    const [hole] = compileTemplate("${a.b + 1}").holes;

    expect(hole?.expr?.$type).toBe("Binary");
  });

  // The evaluator turns this into VN1002; compiling must not throw, or a bad
  // placeholder would take down the parse instead of the run that reaches it.
  it("leaves a placeholder that is not an expression unparsed", () => {
    const [hole] = compileTemplate("${let}").holes;

    expect(hole?.source).toBe("let");
    expect(hole?.expr).toBeUndefined();
  });

  // The wrapper the placeholder is parsed in used to be `expect`, which takes a
  // block of checks as well as a subject, so an empty map read as an empty block
  // and the hole came back holding nothing.
  it("reads a map literal, down to the empty one", () => {
    const sources = ["{}", "{ }", "{ a: 1 }", "{ a: { b: 1 } }"];

    for (const source of sources) {
      const [hole] = compileTemplate(`\${${source}}`).holes;

      expect(hole?.expr?.$type, source).toBe("MapLit");
    }
  });

  it("compiles a given literal once", () => {
    expect(compileTemplate("${x} twice")).toBe(compileTemplate("${x} twice"));
  });

  it("has nothing to fill in a plain string", () => {
    expect(compileTemplate("no placeholders").holes).toEqual([]);
  });
});
