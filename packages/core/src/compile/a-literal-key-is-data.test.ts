import { describe, expect, it } from "vitest";
import { type EvalEnv, evaluate } from "../expr/index.js";
import type { Document, LetStmt } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import { kindOf } from "../value/index.js";

/** Evaluate one expression, with `slow` bound to something not here yet. */
function value(expression: string): unknown {
  const bindings: Record<string, unknown> = { slow: Promise.resolve(7) };
  const env: EvalEnv = { lookup: (name) => bindings[name] };
  const document = parse(`const it = ${expression}`).ast as Document;
  return evaluate((document.decls[0] as LetStmt).value, env);
}

/**
 * The own field a key names, read past the `__proto__` accessor.
 *
 * `map.__proto__` would ask what the map inherits from rather than what it
 * holds, which is the confusion under test.
 */
function own(map: object, key: string): unknown {
  return Object.getOwnPropertyDescriptor(map, key)?.value;
}

/**
 * A map literal's key is a key, whatever it spells.
 *
 * `{ "__proto__": x }` was built by assigning each field in turn, and that one
 * assignment ran the inherited setter instead of storing: the literal came back
 * with `x` as its prototype, so `typeOf` answered `handle` for a value no
 * plugin made, `.keys` was empty, and a read of any field of `x` succeeded
 * through the injected chain.
 *
 * The same three names stay refused as assignment targets (VN3023). Writing
 * `m["__proto__"] = 1` names a place that belongs to what made the map; a
 * literal's key names a field of the map being made.
 */
describe("a key written in a literal", () => {
  const RESERVED = ["__proto__", "constructor", "prototype"];

  it.each(RESERVED)("keeps %s as an ordinary field", (name) => {
    const map = value(`{ '${name}': { pwned: 7 } }`) as Record<string, unknown>;

    expect(kindOf(map)).toBe("map");
    expect(Object.getPrototypeOf(map)).toBe(Object.prototype);
    expect(Object.keys(map)).toEqual([name]);
    expect(map[name]).toEqual({ pwned: 7 });
    expect("pwned" in map).toBe(false);
  });

  /**
   * One key per size the unrolled builders cover, and one past them, because
   * each size is a separate builder and only the looped one was ever read.
   */
  it.each([1, 2, 3, 4, 5])("keeps it in a literal of %i fields", (size) => {
    const others = Array.from({ length: size - 1 }, (_, at) => `f${at}: ${at}`);
    const map = value(`{ '__proto__': 1, ${others.join(", ")} }`) as Record<string, unknown>;

    expect(Object.getPrototypeOf(map)).toBe(Object.prototype);
    expect(Object.keys(map)).toEqual(["__proto__", ...others.map((_, at) => `f${at}`)]);
    expect(own(map, "__proto__")).toBe(1);
  });

  it("keeps source order when the key is not first", () => {
    const map = value("{ a: 1, '__proto__': 2, b: 3 }") as Record<string, unknown>;

    expect(Object.keys(map)).toEqual(["a", "__proto__", "b"]);
  });

  it("settles a field that has not arrived yet", async () => {
    const settled = (await value("{ '__proto__': slow, a: 1 }")) as Record<string, unknown>;

    expect(Object.getPrototypeOf(settled)).toBe(Object.prototype);
    expect(own(settled, "__proto__")).toBe(7);
    expect(settled.a).toBe(1);
  });

  it("pours a poured map's own field in rather than through it", () => {
    const map = value("{ ...{ '__proto__': 1 }, b: 2 }") as Record<string, unknown>;

    expect(Object.getPrototypeOf(map)).toBe(Object.prototype);
    expect(Object.keys(map)).toEqual(["__proto__", "b"]);
    expect(own(map, "__proto__")).toBe(1);
  });

  it("lets a later key beat what a spread poured, even that one", () => {
    const map = value("{ ...{ '__proto__': 1 }, '__proto__': 2 }") as Record<string, unknown>;

    expect(Object.keys(map)).toEqual(["__proto__"]);
    expect(own(map, "__proto__")).toBe(2);
  });
});
