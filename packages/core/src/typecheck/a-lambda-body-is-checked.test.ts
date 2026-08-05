import { describe, expect, it } from "vitest";
import { parse } from "../parse/index.js";
import type { Problem } from "../problem/index.js";
import { checkTypes } from "./check-types.js";

function found(source: string): Problem[] {
  return checkTypes(parse(source).ast).problems;
}

function titles(source: string): string[] {
  return found(source).map((problem) => problem.title);
}

/**
 * The mistake a lambda used to hide.
 *
 * A lambda's parameter has no annotation and never will, so until the call it
 * sits in handed it a type the body was walked against a fresh variable, and a
 * variable answers `dynamic` to every member read. The same mistake was fatal
 * on one line and silent two lines away.
 */
describe("a mistake inside a lambda", () => {
  it("is the mistake it would be outside one", () => {
    const source = ["const xs = [1, 2, 3]", "const inside = xs.map(x => x.nope)"];

    expect(titles(source.join("\n"))).toEqual(['Type number has no member "nope".']);
  });

  it("takes the element type from the receiver rather than from a guess", () => {
    const source = ['const ws = ["a", "b"]', "const inside = ws.map(w => w.nope)"];

    expect(titles(source.join("\n"))).toEqual(['Type string has no member "nope".']);
  });

  /**
   * Column 28 is the `x` of `x.nope` inside the lambda, which is where the same
   * read outside one is reported from: the member expression, not the statement
   * and not the `.map` that holds it.
   */
  it("is reported where it was written, not at the call that holds it", () => {
    const source = ["const xs = [1, 2, 3]", "const inside = xs.map(x => x.nope)"];
    const at = found(source.join("\n"))[0]?.span;

    expect([at?.line, at?.column]).toEqual([2, 28]);
  });
});

/** Every member that hands its callback an element hands over the real one. */
describe("the members that know their element", () => {
  const XS = "const xs = [1, 2, 3]";
  const EACH = ["map", "filter", "sortBy", "sumBy", "countBy", "groupBy", "keyBy", "forEach"];

  /**
   * One row per member, because the count does not tell them apart: a member
   * handing its callback the whole list reports once per line too, and only the
   * type named in the sentence says which of the two happened.
   */
  it.each(EACH)("hands it over through %s", (name) => {
    expect(titles([XS, `const r = xs.${name}(x => x.nope)`].join("\n"))).toEqual([
      'Type number has no member "nope".',
    ]);
  });

  it("hands a map's value over to mapValues and filterValues", () => {
    const m = "const m: map<number> = { a: 1 }";
    const lines = ["const p = m.mapValues(v => v.nope)", "const q = m.filterValues(v => v.nope)"];

    expect(titles([m, ...lines].join("\n"))).toEqual([
      'Type number has no member "nope".',
      'Type number has no member "nope".',
    ]);
  });

  it("leaves a member the element does have alone", () => {
    const lines = ['const ws = ["a"]', "const r = ws.map(w => w.len).sum"];

    expect(titles(lines.join("\n"))).toEqual([]);
  });
});

/**
 * The silent wrong answer this was really about.
 *
 * `entries` hands its pairs back as two-item lists, so `e.value` is nothing,
 * `-nothing` is `NaN`, and sorting by `NaN` moves nothing at all. The report
 * came out ordered by nothing and said so nowhere.
 */
describe("a pair read by name", () => {
  const COUNTS = 'const counts = ["a", "b", "a"].countBy(w => w)';

  it("is refused, naming the type the pair really is", () => {
    const bad = "const worst = counts.entries.sortBy(e => -e.value)";

    expect(titles([COUNTS, bad].join("\n"))).toEqual([
      'Type list<string | number> has no member "value".',
    ]);
  });

  it("says how a list is read, and what a pair's positions hold", () => {
    const bad = "const worst = counts.entries.sortBy(e => -e.value)";

    expect(found([COUNTS, bad].join("\n"))[0]?.help).toBe(
      "A list is read by position, not by name: `e[0]`, `e[1]`, and so on. `entries`, `zip` and `pairwise` all hand back pairs this way, so a key is `[0]` and its value is `[1]`.",
    );
  });

  /**
   * The sentence may not claim a length. A `list<number>` is a pair or a row of
   * six and there is no tuple here to tell them apart, so "a two-item list" was
   * false for the row and true only for the case it was written against.
   */
  it("claims no length, because the checker cannot know one", () => {
    const rows = "const rows = [[1, 2, 3]]\nconst bad = rows.map(r => r.value)";
    const help = found(rows)[0]?.help ?? "";

    expect(help).toContain("`r[0]`, `r[1]`, and so on");
    expect(help).not.toContain("two-item");
  });

  it("leaves the working spelling alone, which is the one the help names", () => {
    const good = "const best = counts.entries.sortBy(e => -e[1])";

    expect(titles([COUNTS, good].join("\n"))).toEqual([]);
  });
});

/**
 * Where the receiver knows nothing, the body is left alone.
 *
 * A false positive here refuses a working program, and this runs over every
 * file in the repository.
 */
describe("a lambda over something unknown", () => {
  it("says nothing about a body it cannot type", () => {
    expect(titles("fn each(xs) => xs.map(x => x.whatever)")).toEqual([]);
  });

  it("says nothing about a lambda handed to something dynamic", () => {
    const source = ["fn each(f: dynamic) => f", "const r = each(x => x.whatever)"];

    expect(titles(source.join("\n"))).toEqual([]);
  });
});
