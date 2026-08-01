import { createTestHost } from "@venn-lang/contracts";
import { checkTypes, expand, parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createDecoratorSource } from "../decorators/index.js";
import { buildRegistry } from "../registry/index.js";
import { collectFragments } from "../scheduler/index.js";
import { checkDocument } from "./check-document.js";

/**
 * Files that are wrong in a way expansion is the one to notice.
 *
 * Every one of these used to pass `venn check` and fail `venn test`, which is
 * the worst shape a checker can be in: it is the fast gate in CI and the thing
 * the editor draws, and both said a file was fine while the run refused it.
 */
const WRONG = [
  {
    how: "a decorator nothing provides",
    source: '@banana\nflow "f" {\n  step "s" {\n    print 1\n  }\n}',
  },
  {
    how: "a decorator on the wrong kind of thing",
    source:
      'deco loud(target: Fn) {\n  target.meta "x" 1\n}\n\n@loud\nflow "f" {\n  step "s" {\n    print 1\n  }\n}',
  },
  {
    how: "a verb the handle does not have",
    source: 'deco loud(target: Fn) {\n  target.wobble "x"\n}\n\n@loud\nfn f() => 1\nprint f()',
  },
];

/** Both passes, because both are what `venn check` runs over a file. */
function checked(source: string): string[] {
  const document = parse(source).ast;
  const registry = buildRegistry({ plugins: [], caps: createTestHost().caps });
  const found = checkDocument({
    document,
    registry,
    fragments: new Set(collectFragments(document).keys()),
    decorators: createDecoratorSource([]),
  });
  return [...found, ...checkTypes(document).problems].map((problem) => problem.code);
}

/** What expansion reports, which is what `venn test` says before it runs a thing. */
function expanded(source: string): string[] {
  const found = expand({
    document: parse(source).ast,
    decorators: createDecoratorSource([]),
  });
  return found.problems.map((problem) => problem.code);
}

describe("venn check is a subset of venn test", () => {
  for (const wrong of WRONG) {
    it(`reports ${wrong.how} without running anything`, () => {
      const byExpansion = expanded(wrong.source);

      expect(byExpansion.length).toBeGreaterThan(0);
      expect(checked(wrong.source)).toEqual(expect.arrayContaining(byExpansion));
    });
  }

  /**
   * The relation itself, which is what keeps a new code from being added to one
   * path only. A code the runner can raise before running is a code the checker
   * has to raise, or a file is green in CI and red on the machine that runs it.
   */
  it("says at least what expansion says, for every one of them", () => {
    const missed = WRONG.filter((wrong) => {
      const byCheck = new Set(checked(wrong.source));
      return expanded(wrong.source).some((code) => !byCheck.has(code));
    });

    expect(missed.map((wrong) => wrong.how)).toEqual([]);
  });

  it("says nothing about a decorator that is right", () => {
    const source =
      'deco loud(target: Flow) {\n  target.meta "tags" "x"\n}\n\n@loud\nflow "f" {\n  step "s" {\n    print 1\n  }\n}';

    expect(checked(source)).toEqual([]);
    expect(expanded(source)).toEqual([]);
  });
});
