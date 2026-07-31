import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../registry/index.js";
import { collectFragments } from "../scheduler/index.js";
import { checkDocument } from "./check-document.js";

const plugin = definePlugin({
  name: "@t/m",
  version: "0",
  namespace: "t",
  actions: [defineAction({ name: "noop", run: () => undefined })],
});

function check(source: string) {
  const { ast, problems } = parse(source);
  expect(problems).toEqual([]);
  const registry = buildRegistry({ plugins: [plugin], caps: createTestHost().caps });
  return checkDocument({
    document: ast,
    registry,
    fragments: new Set(collectFragments(ast).keys()),
  });
}

const codes = (source: string): string[] => check(source).map((problem) => problem.code);

/**
 * A decorator's body runs at expansion, before the program exists. The run says
 * so when it gets there; this is the same sentence in the editor, where the
 * author still has the file open.
 */
describe("a deco body's calls", () => {
  it("leaves a verb on the target alone — it is not an action anyone provides", () => {
    const source = [
      "deco memoize(target: Fn) {",
      "  const cache = {}",
      '  target.meta "cache" cache',
      "}",
    ].join("\n");

    expect(check(source)).toEqual([]);
  });

  it("refuses a plugin verb, and says why", () => {
    const found = check(
      ['import { t } from "@t/m"', "deco boom(target: Fn) {", "  t.noop", "}"].join("\n"),
    );

    expect(found).toHaveLength(1);
    expect(found[0]?.code).toBe("VN2016");
    expect(found[0]?.title).toBe(
      "A decorator runs before the program exists, so it cannot call `t.noop`.",
    );
  });

  it("refuses one bound into a `let` just the same", () => {
    const source = [
      'import { t } from "@t/m"',
      "deco boom(target: Fn) {",
      '  const r = t.noop "x"',
      "}",
    ].join("\n");

    expect(codes(source)).toEqual(["VN2016"]);
  });

  it("refuses a namespace some loaded plugin owns even without a `use`", () => {
    expect(codes(["deco boom(target: Fn) {", "  t.noop", "}"].join("\n"))).toEqual(["VN2016"]);
  });

  it("still resolves the same verb outside the decorator", () => {
    const source = [
      'import { t } from "@t/m"',
      "deco tag(target: Flow) {",
      '  target.meta "tagged" true',
      "}",
      "@tag",
      'flow "f" { t.noop }',
    ].join("\n");

    expect(check(source)).toEqual([]);
  });
});
