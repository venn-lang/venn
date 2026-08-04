import type { AstNode, Grammar } from "langium";
import { describe, expect, it } from "vitest";
import { VennGrammar } from "../generated/grammar.js";
import { KEYWORDS } from "./keywords.js";

/** A word somebody could otherwise have written as a name. */
const A_WORD = /^[A-Za-z_]\w*$/;

/** Every keyword literal in the grammar, wherever in it the rule sits. */
function keywordsIn(node: object): Set<string> {
  const found = new Set<string>();
  for (const child of walk(node)) {
    const keyword = child as { $type?: string; value?: unknown };
    if (keyword.$type !== "Keyword" || typeof keyword.value !== "string") continue;
    if (A_WORD.test(keyword.value)) found.add(keyword.value);
  }
  return found;
}

function* walk(node: object, seen: WeakSet<object> = new WeakSet()): Generator<object> {
  if (seen.has(node)) return;
  seen.add(node);
  yield node;
  for (const [key, value] of Object.entries(node)) {
    // `$container` and `ref` point back up, and following either never ends.
    if (key.startsWith("$") || key === "ref") continue;
    for (const child of Array.isArray(value) ? value : [value]) {
      if (child && typeof child === "object") yield* walk(child as object, seen);
    }
  }
}

/** The rule by that name, which is the only runtime-walkable copy of it. */
function ruleNamed(grammar: Grammar, name: string): AstNode {
  const rule = grammar.rules.find((one) => one.name === name);
  expect(rule, name).toBeDefined();
  return rule as AstNode;
}

/**
 * The words the language reserves, counted once.
 *
 * There were six hand-written copies of this set and three had drifted: `while`
 * was removed from the language and stayed in three of them, `loop` replaced it
 * and reached none, and `namespace`, `null`, `true` and `false` were keywords
 * that no member position would take. Each of those was a payload field somebody
 * could not read, because the field names in a payload come from someone else.
 *
 * `VennKeywordNames` in the generated AST is a type and is gone at runtime, so
 * the grammar object itself is what the lists are measured against.
 */
describe("the words the grammar reserves", () => {
  const grammar = VennGrammar();
  const all = keywordsIn(grammar);

  it("has the words a member position was missing", () => {
    for (const word of ["loop", "namespace", "null", "true", "false"]) {
      expect(all.has(word), word).toBe(true);
    }
  });

  it("no longer has the word that was removed from the language", () => {
    expect(all.has("while")).toBe(false);
    expect(all.has("use")).toBe(false);
  });

  /** `Word` is documented as ID or ANY keyword, so it has to actually be that. */
  it("takes every one of them in member, map-key and dotted-tail position", () => {
    const word = keywordsIn(ruleNamed(grammar, "Word"));

    expect([...all].filter((one) => !word.has(one))).toEqual([]);
  });

  it("is exactly what the parse layer refuses a suggestion for", () => {
    expect([...all].sort()).toEqual([...KEYWORDS].sort());
  });
});
