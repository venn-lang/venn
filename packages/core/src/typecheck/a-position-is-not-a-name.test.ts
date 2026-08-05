import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";

function problems(source: string): string[] {
  return checkTypes(parse(source).ast).problems.map((problem) => problem.title);
}

function helpFor(source: string): (string | undefined)[] {
  return checkTypes(parse(source).ast).problems.map((problem) => problem.help);
}

/**
 * A written key is a member read; a position is the element or the character.
 *
 * The record half of this was closed and the list half was not, so the bracket
 * spelling kept the wrong promise over exactly one receiver: `names["len"]` was
 * typed as the element although the value is the number 2, which accepted
 * `const s: string = names["len"]` and refused `const n: number = names["len"]`,
 * the wrong way round in both directions at once.
 */
describe("a key written out against a list", () => {
  const names = 'const names = ["a", "b"]';

  it("is the member it names, not the element", () => {
    expect(problems(`${names}\nconst n: number = names["len"]`)).toEqual([]);
    expect(problems(`${names}\nconst s: string = names["len"]`)).toEqual([
      "Type mismatch: expected string, found number.",
    ]);
  });

  it("is refused when the list has no such member", () => {
    expect(problems(`${names}\nconst s = names["naoExiste"]`)).toEqual([
      'Type list<string> has no member "naoExiste".',
    ]);
  });

  /**
   * `xs[0]` and `xs["0"]` are one key, so they have to be one type, and both
   * carry the nothing a position answers with when there is nothing there:
   * `["a", "b"][7]` is `null` at run time. So the annotation has to admit it, or
   * the read has to be guarded or given a stand-in.
   */
  it("is the element and the nothing, when the key spells a position", () => {
    const held = 'const a: string | null = names[0]\nconst b: string | null = names["0"]';

    expect(problems(`${names}\n${held}`)).toEqual([]);
    expect(problems(`${names}\nconst a: string = names[0] ?? "z"`)).toEqual([]);
    expect(problems(`${names}\nconst n: number = names["0"]`)).toEqual([
      "Type mismatch: expected number, found string | null.",
    ]);
  });

  it("is the character and the nothing, when the receiver is a string", () => {
    const word = 'const word = "abc"';

    expect(problems(`${word}\nconst a: string = word[0] ?? ""`)).toEqual([]);
    expect(problems(`${word}\nconst b: string | null = word["0"]`)).toEqual([]);
    expect(problems(`${word}\nconst n: number = word[0]`)).toEqual([
      "Type mismatch: expected number, found string | null.",
    ]);
  });

  /**
   * A key the run works out is nobody's mistake about which member it names, and
   * stays nobody's mistake. It is still a position, so it still carries the
   * nothing: `args[i + 1]` is where a flag written without its value arrives, and
   * this read answering the plain element is what let a malformed invocation run
   * to the end and print a plausible wrong report.
   */
  it("leaves a computed key alone", () => {
    expect(problems(`${names}\nconst k = "len"\nconst s: string | null = names[k]`)).toEqual([]);
  });
});

/**
 * The member tables are object literals, so a name every object inherits used
 * to answer with something of the host's.
 *
 * A `Function` came back where a `Type` belongs and `showType` printed it as
 * `undefined`, so the reader was told `expected number, found undefined` about
 * a field that simply is not there. On a list it was worse: the table holds
 * thunks, `Object.prototype.constructor` is not one, and calling it threw a raw
 * `TypeError` out through the top of `venn check` with no code and no line.
 */
describe("a name every object inherits", () => {
  it("is not a field of a map", () => {
    expect(problems('const m = { a: 1 }\nconst n: number = m["constructor"]')).toEqual([
      'Type { a: number } has no field "constructor".',
    ]);
  });

  it("is not a member of a unit", () => {
    expect(problems('const d = 5s\nconst q: number = d["toString"]')).toEqual([
      'Type duration has no member "toString".',
    ]);
  });

  it("is not a member of a list or a string", () => {
    expect(problems('const xs = [1]\nconst a = xs["__proto__"]')).toEqual([
      'Type list<number> has no member "__proto__".',
    ]);
    expect(problems('const s = "a"\nconst b = s["valueOf"]')).toEqual([
      'Type string has no member "valueOf".',
    ]);
  });

  /** The path that crashed: a union sends the name into every branch's table. */
  it("does not throw when a union is indexed by one", () => {
    const source = ["type Either = list<number> | string", 'fn read(x: Either) => x["__proto__"]'];

    expect(() => problems(source.join("\n"))).not.toThrow();
    expect(problems(source.join("\n"))).toEqual([]);
  });
});

/**
 * A write to a field the shape does not list is refused, and says so as a write.
 *
 * Refusing it is deliberate: `stats.hits = 1` was always refused, and now that
 * both spellings are one question the bracket is too. But the reader's way out
 * of a write is not the reader's way out of a read, so the sentence says what
 * to do about the map rather than only what is missing from it.
 */
describe("an index write to a field nothing declares", () => {
  const stats = "let stats = {}";

  it("names the write rather than repeating the read", () => {
    expect(problems(`${stats}\nstats["hits"] = 1`)).toEqual([
      'Type {} has no field "hits" to write to.',
    ]);
    expect(helpFor(`${stats}\nstats["hits"] = 1`)[0]).toContain("map<number>");
  });

  it("says the same about the dot spelling, which is the same question", () => {
    expect(problems(`${stats}\nstats.hits = 1`)).toEqual([
      'Type {} has no field "hits" to write to.',
    ]);
  });

  it("keeps quiet where the map was declared open, or the key worked out", () => {
    expect(problems('let open: map<number> = {}\nopen["hits"] = 1')).toEqual([]);
    expect(problems(`${stats}\nconst k = "hits"\nstats[k] = 1`)).toEqual([]);
  });

  /** Reading the same field is still reported, in the read's own words. */
  it("leaves the read's sentence alone", () => {
    expect(problems(`${stats}\nconst n = stats["hits"]`)).toEqual(['Type {} has no field "hits".']);
  });
});
