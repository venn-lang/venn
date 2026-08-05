import { describe, expect, it } from "vitest";
import { compileExpr } from "../compile/index.js";
import type { Expr } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import type { EvalEnv } from "./eval-env.types.js";
import { indexValue, memberValue } from "./member-value.js";

/** Evaluate one expression with some names already bound, the way a program would. */
function value(source: string, bound: Record<string, unknown> = {}): unknown {
  const document = parse(`const it = ${source}`).ast;
  const binding = document.decls[0] as unknown as { value: Expr };
  const env: EvalEnv = { lookup: (name: string) => bound[name] };
  return compileExpr(binding.value)(env);
}

/**
 * `xs[0]` and `xs["0"]` are the same element, and `s[0]` is a character.
 *
 * The one reader routes an index through the member read, and a member read
 * only answers names a table declares, so a position that arrived as anything
 * but a number against a list fell through to `null`: `s[0]` and `s[i]` stopped
 * giving the character and `xs["0"]` and `xs[k]` stopped giving the element.
 * Every one of them answered `null` in silence, which is the one answer that
 * leaves nothing for a reader to go on, and the same mistake was reported when
 * it was spelled `s["0"]` and not when it was spelled `s[0]`.
 */
describe("a key that spells a position", () => {
  it("reads a character out of a string, however the position arrived", () => {
    expect(value('"abc"[0]')).toBe("a");
    expect(value('"abc"[i]', { i: 2 })).toBe("c");
    expect(value('"abc"["0"]')).toBe("a");
  });

  it("reads an element out of a list, however the position arrived", () => {
    const xs = { xs: [10, 20, 30] };

    expect(value("xs[0]", xs)).toBe(10);
    expect(value('xs["0"]', xs)).toBe(10);
    expect(value("xs[k]", { ...xs, k: "0" })).toBe(10);
  });

  it("is absent past the end, which is the one nothing", () => {
    expect(value('"abc"[9]')).toBeNull();
    expect(value("xs[9]", { xs: [1] })).toBeNull();
  });

  /** Only the canonical spelling is a position; the rest are names of fields. */
  it("keeps a name a name", () => {
    expect(value('xs["len"]', { xs: [1, 2] })).toBe(2);
    expect(value('"abc"["upper"]')).toBe("ABC");
    expect(value('xs["00"]', { xs: [1, 2] })).toBeNull();
    expect(value('xs["-1"]', { xs: [1, 2] })).toBeNull();
  });

  /** A map is read by name whatever the key looks like: `m[1]` and `m["1"]` are one key. */
  it("leaves a map alone", () => {
    expect(value("m[1]", { m: { "1": "one" } })).toBe("one");
    expect(value('m["1"]', { m: { "1": "one" } })).toBe("one");
  });

  /** The refusal the epic put in both write halves is a write's business, not a read's. */
  it("still keeps the host's own names out of a position read", () => {
    expect(indexValue([1, 2], "__proto__")).toBeNull();
    expect(indexValue("abc", "constructor")).toBeNull();
    expect(indexValue([1, 2], "length")).toBeNull();
  });
});

/**
 * A bigint is the host's, and the language has nothing to say about it.
 *
 * It answered `"number"` to `kindOf`, which handed it to the number methods,
 * every one of which does host arithmetic: `memberValue(10n, "abs")` threw a
 * raw `TypeError` with no code and no span, which is the one answer a member
 * read must never give. One arrives whenever a plugin verb returns one.
 */
describe("a member of a bigint", () => {
  it("is absent rather than a host failure", () => {
    expect(memberValue(10n, "abs")).toBeNull();
    expect(memberValue(10n, "isEven")).toBeNull();
    expect(memberValue(10n, "pow")).toBeNull();
    expect(indexValue(10n, "toString")).toBeNull();
  });
});
