import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { defineAction, definePlugin } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../registry/index.js";
import { collectFragments } from "../scheduler/index.js";
import { checkDocument } from "./check-document.js";

const NEWLINE = String.fromCharCode(10);

const plugin = definePlugin({
  name: "@t/net",
  namespace: "net",
  requires: ["net"],
  actions: [defineAction({ name: "fetch", run: () => 1 })],
});

/** The titles reported for a source, which is what a reader sees. */
function titles(...lines: string[]): string[] {
  const document = parse(lines.join(NEWLINE)).ast;
  const registry = buildRegistry({ plugins: [plugin], caps: createTestHost().caps });
  return checkDocument({
    document,
    registry,
    fragments: new Set(collectFragments(document).keys()),
  }).map((one) => one.title);
}

const IMPORT = 'import { net } from "@t/net"';

const HEAD = "A `fn` is pure, so it cannot call `net.fetch`.";

const IN_A_FRAGMENT = "A verb belongs in a `fragment`, or at the top level of a file.";

const IN_A_STATEMENT =
  "A verb needs a statement of its own. To keep what it answers, write `let xs = []` and then `forEach n in ns { xs = xs.push(…) }`.";

/**
 * A verb inside a lambda, told something it can act on.
 *
 * A lambda is a pure body like any other, so purity refused it correctly and
 * then offered the one way out it cannot take: `[1, 2].map(fn (n) => …)` was
 * told to move the verb to the top level of a file while already being at the
 * top level of one. The rule was right and the second sentence was impossible.
 */
describe("a verb written inside a lambda", () => {
  it("keeps the head and takes a way out a lambda can follow", () => {
    const said = titles(IMPORT, "let rows = [1, 2]", "const r = rows.map(fn (n) => net.fetch())");

    expect(said[0]).toBe(`${HEAD} ${IN_A_STATEMENT}`);
  });

  it("says it for the arrow spelling too, which is the same body", () => {
    const said = titles(IMPORT, "let rows = [1, 2]", "const r = rows.map(n => net.fetch())");

    expect(said[0]).toBe(`${HEAD} ${IN_A_STATEMENT}`);
  });

  /** The nearest body decides, because that is the one the reader stands in. */
  it("says it for a lambda nested inside a fn, where both bodies are pure", () => {
    const said = titles(IMPORT, "fn f(ns) => ns.map(n => net.fetch())");

    expect(said[0]).toBe(`${HEAD} ${IN_A_STATEMENT}`);
  });

  /** A `fn` somebody declared can do both of those, so its clause is unchanged. */
  it.each([
    ["a block body", "fn f(n) { net.fetch() }"],
    ["an expression body", "fn f(n) => net.fetch()"],
  ])("leaves the declared `fn` sentence exactly as it was (%s)", (_what, source) => {
    expect(titles(IMPORT, source)[0]).toBe(`${HEAD} ${IN_A_FRAGMENT}`);
  });

  /**
   * The way out has to run, or the sentence is a promise the language breaks.
   * Both spellings the clause names, with the verb the reader wrote in them.
   */
  it("names a loop that checks clean", () => {
    const kept = titles(
      IMPORT,
      "let ns = [1, 2]",
      "let xs = []",
      "forEach n in ns {",
      "  xs = xs.push(net.fetch())",
      "}",
      "print xs",
    );

    expect(kept).toEqual([]);
  });

  it("says nothing about a lambda that reaches nothing", () => {
    expect(titles("let rows = [1, 2]", "const r = rows.map(n => n + 1)")).toEqual([]);
  });
});
