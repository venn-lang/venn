import { describe, expect, it } from "vitest";
import { parse } from "./parse.js";

/**
 * Syntax that parsed and did nothing, now gone.
 *
 * Each of these was a rule the grammar accepted, the checker passed and no
 * runtime read, so the name it bound was absent and whatever used it failed
 * somewhere else. What this holds is that they stay out: a rule that comes back
 * without a runtime behind it is the same bug again.
 */
const REMOVED = [
  { name: "factory", source: "factory User {\n  email: 1\n}" },
  { name: "dataset", source: 'dataset clients = ["a"]' },
  { name: "report", source: 'report "junit"' },
];

describe("syntax that was removed", () => {
  for (const removed of REMOVED) {
    it(`does not silently accept ${removed.name}`, () => {
      const { ast, problems } = parse(removed.source);

      // Either it fails to parse, or it parses as something else entirely (an
      // action call nobody provides). What it must never do is parse into a
      // declaration of its own, which is what left the name unbound.
      const declared = ast.decls.map((decl) => decl.$type);
      expect(declared).not.toContain("FactoryDecl");
      expect(declared).not.toContain("DatasetDecl");
      expect(declared).not.toContain("ReportDecl");
      expect(problems.length > 0 || declared.every((kind) => kind === "ActionCall")).toBe(true);
    });
  }

  /** The two spellings that do work, so the removal took nothing else with it. */
  it("still takes the imports that publish by name", () => {
    const source = 'import { total } from "./cart.vn"\nimport * as cart from "./cart.vn"';

    expect(parse(source).problems).toEqual([]);
  });
});
