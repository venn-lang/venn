import { PRELUDE, preludeValues, preludeVerbs } from "@venn-lang/prelude";
import { describe, expect, it } from "vitest";
import { PRELUDE_VALUES } from "../expr/index.js";
import { parse } from "../parse/index.js";
import { checkTypes } from "./check-types.js";
import { PRELUDE_SPECS } from "./prelude-types.js";

/**
 * The prelude is published in one place and implemented in another, so the two
 * have to be held against each other. A name described and never implemented is
 * a hover for something that is not there; one implemented and never described
 * is a name nobody can find out about.
 */
describe("the prelude and what implements it", () => {
  it("describes exactly the values the kernel implements", () => {
    expect(Object.keys(PRELUDE_VALUES).sort()).toEqual(preludeValues().sort());
  });

  it("gives every name a signature the checker can read", () => {
    expect(Object.keys(PRELUDE_SPECS).sort()).toEqual(Object.keys(PRELUDE).sort());
    for (const [name, spec] of Object.entries(PRELUDE_SPECS)) {
      expect(spec.type, name).toBeDefined();
      expect(spec.doc.length, name).toBeGreaterThan(0);
    }
  });

  it("gives every name a signature line that starts with the name", () => {
    for (const [name, entry] of Object.entries(PRELUDE)) {
      expect(entry.signature.startsWith(name), name).toBe(true);
    }
  });

  /** Every one of them, since a name in scope that nothing types is a hole. */
  it("types every name where it is used", () => {
    for (const name of Object.keys(PRELUDE)) {
      const { ast } = parse(`print ${name}`);
      const problems = checkTypes(ast).problems.map((problem) => problem.title);

      expect(problems, name).toEqual([]);
    }
  });

  it("keeps values and verbs apart, with nothing in both", () => {
    const both = preludeValues().filter((name) => preludeVerbs().includes(name));

    expect(both).toEqual([]);
  });
});
