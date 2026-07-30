import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

/** Type-check a program and return the titles reported. */
function titles(source: string): string[] {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  return checkTypes(ast).problems.map((problem) => problem.title);
}

describe("regex as a type", () => {
  it("is a name a binding can be annotated with", () => {
    expect(titles('const p: regex = regex(r"d+")')).toEqual([]);
  });

  it("carries the members a pattern offers", () => {
    const source = `const p = regex(r"d+")
const ok: bool = p.test("1")
const src: string = p.source
const fl: string = p.flags
const groups: list<string> = p.match("1")`;

    expect(titles(source)).toEqual([]);
  });

  /** Opaque means those four and nothing else. */
  it("refuses a member it does not have", () => {
    const said = titles('const p = regex(r"d+")\nprint p.nope');

    expect(said[0]).toContain('regex has no member "nope"');
  });

  it("refuses a member read as the wrong type", () => {
    const said = titles('const p = regex(r"d+")\nconst n: number = p.source');

    expect(said[0]).toContain("expected number, found string");
  });

  it("takes flags, and does not require them", () => {
    expect(titles('const a = regex(r"d+")\nconst b = regex(r"d+", "g")')).toEqual([]);
  });

  /**
   * A pattern spelled wrong is knowable where it is written. Finding out at run
   * time means finding out on the line that used it.
   */
  it("refuses a pattern that does not compile, before anything runs", () => {
    const said = titles('const p = regex(r"[unclosed")');

    expect(said[0]).toContain("This is not a pattern");
    expect(said[0]).toContain("Unterminated character class");
  });

  it("says nothing about a pattern it cannot know yet", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Venn interpolation under test.
    const source = 'const digits = "\\d+"\nconst p = regex("${digits}")';

    expect(titles(source)).toEqual([]);
  });

  /** Built from a value, so what it will be is not knowable here. */
  it("says nothing about a pattern given a name rather than text", () => {
    expect(titles('const written = "[unclosed"\nconst p = regex(written)')).toEqual([]);
  });

  it("says nothing about a call with no pattern at all", () => {
    expect(titles("const p = regex()")).toEqual([]);
  });

  it("leaves a call to something else alone", () => {
    expect(titles('fn regexish(s) => s\nprint regexish("[unclosed")')).toEqual([]);
  });
});
