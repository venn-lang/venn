import { fc, test } from "@fast-check/vitest";
import { describe, expect, it } from "vitest";
import { compileExpr } from "../compile/index.js";
import type { EvalEnv } from "../expr/index.js";
import { indexValue, memberValue } from "../expr/member-value.js";
import type { Expr } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import { readPath } from "../pattern/index.js";

/**
 * The three ways into a value: `m.k`, `m[k]`, and the steps a pattern walks.
 *
 * One reader now answers all three, so the invariants below are asked of each
 * of them rather than of the one that happened to be written first.
 */
const READERS: Readonly<Record<string, (value: unknown, name: string) => unknown>> = {
  "m.k": memberValue,
  "m[k]": indexValue,
  "a pattern step": (value, name) => readPath(value, [name]),
};

/** Evaluate one expression the way a program would, with nothing in scope. */
function value(source: string): unknown {
  const document = parse(`const it = ${source}`).ast;
  const binding = document.decls[0] as unknown as { value: Expr };
  // Nothing is in scope: a name that reaches here is one the program never
  // bound, which is one of the ways absence arrives.
  const env: EvalEnv = { lookup: () => undefined };
  return compileExpr(binding.value)(env);
}

/**
 * The language has one nothing.
 *
 * `null` is in `Value` and `undefined` is not, so a program that reads
 * something absent has to get the one it can name. When it got the other, the
 * guard everybody writes took the wrong branch:
 *
 * ```venn
 * if data.missing == null { … }     # was false, because absent was undefined
 * ```
 *
 * Equality is strict and does no coercion, which is deliberate, so this cannot
 * be papered over at the comparison. Absence has to be `null` where it is
 * produced.
 */
describe("absence is null, wherever it comes from", () => {
  it("reads a member nobody set as null", () => {
    expect(value("{ a: 1 }.nope")).toBeNull();
    expect(value("{ a: 1 }.nope == null")).toBe(true);
  });

  it("reads past the end of a list as null", () => {
    expect(value("[1, 2][9]")).toBeNull();
    expect(value("[1, 2][9] == null")).toBe(true);
  });

  it("reads a member of nothing as null, rather than failing", () => {
    expect(value("null.anything")).toBeNull();
    expect(value("null[0]")).toBeNull();
  });

  it("reads a name nothing bound as null", () => {
    expect(value("nowhere")).toBeNull();
    expect(value("nowhere == null")).toBe(true);
  });

  /** Every operator that asks "is there anything here" has to give one answer. */
  it("answers the same to every question about it", () => {
    expect(value("{ a: 1 }.nope ?? 'fallback'")).toBe("fallback");
    expect(value("{ a: 1 }.nope?.deeper")).toBeNull();
    expect(value("{ a: 1 }.nope == null && [1][9] == null")).toBe(true);
  });

  /** What the host keeps a value in is not a member, and asking gives nothing. */
  it("gives nothing for what the host stores, not the host's own value", () => {
    expect(memberValue([1, 2], "length")).toBeNull();
    expect(memberValue("abc", "toUpperCase")).toBeNull();
    expect(memberValue({ id: 1 }, "constructor")).toBeNull();
  });

  it("still hands back a member that is there, including a false one", () => {
    expect(value("{ a: false }.a")).toBe(false);
    expect(value("{ a: 0 }.a")).toBe(0);
    expect(value("{ a: null }.a")).toBeNull();
    expect(value("[10, 20][0]")).toBe(10);
  });

  /**
   * The invariant, on any name at all: reading a member off a map that does not
   * have it is `null`, and `undefined` never escapes into a program.
   */
  test.prop([fc.string({ minLength: 1, maxLength: 12 })])("never answers undefined", (name) => {
    fc.pre(name !== "a" && /^[a-z]+$/i.test(name));

    for (const read of Object.values(READERS)) {
      expect(read({ a: 1 }, name)).not.toBe(undefined);
      expect(read([1, 2], name)).not.toBe(undefined);
      expect(read("text", name)).not.toBe(undefined);
      expect(read(null, name)).not.toBe(undefined);
    }
  });

  /**
   * The names every object in the host carries, which are the ones a random
   * string never lands on and the ones that matter: `toString`, `constructor`,
   * `__proto__`, `valueOf`. Each of the three readers used to answer at least
   * one of them with something of the host's, and `m["toString"]` handed over a
   * callable while `m.toString` was already null.
   */
  it.each(Object.entries(READERS))("keeps the host's own names out of %s", (_spelling, read) => {
    // A number is left out on purpose: `toString` is one of its own published
    // members, so it is the one receiver for which an answer here is right.
    for (const name of Object.getOwnPropertyNames(Object.prototype)) {
      expect(read({ id: 1 }, name), name).toBeNull();
      expect(read([1, 2], name), name).toBeNull();
      expect(read("text", name), name).toBeNull();
      expect(read(null, name), name).toBeNull();
    }
  });
});
