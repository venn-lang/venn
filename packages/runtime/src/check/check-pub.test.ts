import { createTestHost } from "@venn-lang/contracts";
import { type Problem, parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../registry/index.js";
import { collectFragments } from "../scheduler/index.js";
import { checkDocument } from "./check-document.js";

function check(source: string): Problem[] {
  const { ast, problems } = parse(source);
  expect(problems.map((problem) => problem.title)).toEqual([]);
  const registry = buildRegistry({ plugins: [], caps: createTestHost().caps });
  const fragments = new Set(collectFragments(ast).keys());
  return checkDocument({ document: ast, registry, fragments });
}

const codes = (source: string): string[] => check(source).map((problem) => problem.code);

/**
 * `pub` on a binding, and the two places it reaches somebody.
 *
 * The scope builder already published a `pub let` inside a `namespace` next to
 * a `pub fn`, and the language reference promises `pub` behaves inside one
 * exactly as it does in a module. The checker refused it anyway, so `pub fn`
 * worked there and `pub const` did not, which made `const` mean something `fn`
 * did not for no reason anybody could read.
 */
describe("where `pub` publishes a binding", () => {
  it("takes a `pub const` inside a namespace", () => {
    expect(codes('namespace cart {\n  pub const empty = "none"\n}')).toEqual([]);
  });

  it("takes a `pub let` there too, since one rule carries both spellings", () => {
    expect(codes("namespace cart {\n  pub let total = 0\n}")).toEqual([]);
  });

  it("takes a `pub fn` there, as it always did", () => {
    expect(codes("namespace cart {\n  pub fn total(x) => x\n}")).toEqual([]);
  });

  it("still takes one at the top of a file", () => {
    expect(codes("pub const seats = 3")).toEqual([]);
  });

  it("takes one inside a nested namespace", () => {
    expect(codes("namespace a {\n  pub namespace b {\n    pub const c = 1\n  }\n}")).toEqual([]);
  });

  /** Everywhere else a `pub` reaches nobody, which is the silence worth saying. */
  it("refuses one inside a step, where it publishes to no one", () => {
    const found = check('flow "F" {\n  step "s" {\n    pub const a = 1\n  }\n}');

    expect(found.map((problem) => problem.code)).toContain("VN2009");
    expect(found[0]?.title).toBe(
      "`pub` publishes at the top of a file or inside a `namespace`, and this one is somewhere else.",
    );
  });

  it("refuses one inside a fragment", () => {
    expect(codes("fragment f() {\n  pub const a = 1\n}")).toContain("VN2009");
  });
});
