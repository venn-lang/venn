import { describe, expect, it } from "vitest";
import { compileExpr } from "../compile/index.js";
import { indexValue } from "../expr/index.js";
import type { Expr } from "../generated/ast.js";
import { parse } from "../parse/index.js";
import { kindOf } from "./kind-of.js";

/** Evaluate one expression the way a program would, with nothing in scope. */
function value(source: string): unknown {
  const document = parse(`const it = ${source}`).ast;
  const binding = document.decls[0] as unknown as { value: Expr };
  return compileExpr(binding.value)({ lookup: () => undefined });
}

/** A plugin's handle: a host object carrying its verbs on a prototype of its own. */
class Servidor {
  close(): void {}
}

/**
 * The line between the language's own data and something the host built.
 *
 * `typeOf` reads this, and the closed set of kinds exists so that it can never
 * name a type the language does not have. Naming the wrong one it does have is
 * the same wrong answer wearing a hat: a map written with a `__proto__` key has
 * had its prototype replaced by more data, and calling that a handle told a
 * reader a plugin made a value no plugin ever touched.
 */
describe("the line between a map and a handle", () => {
  it("calls data a map, whatever is behind it", () => {
    const swapped = { a: 1 };
    Object.setPrototypeOf(swapped, { pwned: 7 });

    expect(kindOf(swapped)).toBe("map");
    expect(kindOf({ a: 1 })).toBe("map");
    expect(kindOf(Object.create(null))).toBe("map");
    expect(kindOf(JSON.parse('{ "__proto__": { "pwned": 7 } }'))).toBe("map");
  });

  /** What marks the host's is the `constructor` its prototype carries. */
  it("still calls a host object a handle", () => {
    expect(kindOf(new Servidor())).toBe("handle");
    expect(kindOf(Object.create(Servidor.prototype))).toBe("handle");
    expect(kindOf(new Date())).toBe("handle");
    expect(kindOf(new Map())).toBe("handle");
  });

  /**
   * A bigint is a number the language cannot do arithmetic with, so it is not
   * one: it answered `"number"` here, which handed it to the number methods,
   * and `Math.abs` threw a raw host `TypeError` with no code and no span.
   */
  it("says nothing about a bigint, which is the host's own", () => {
    expect(kindOf(10n)).toBe("handle");
    expect(kindOf(10)).toBe("number");
  });
});

/**
 * The literal the finding was written against, end to end.
 *
 * `typeOf` said `handle` for a map nobody but the program made, and the value
 * behind the injected key was readable through it. A map answers with its own
 * data and nothing else, so both halves are shut whichever way the literal was
 * built.
 */
describe("a map literal written with a `__proto__` key", () => {
  const written = '{ "__proto__": { pwned: 7 } }';

  it("is a map, and does not hand over what was injected", () => {
    expect(kindOf(value(written))).toBe("map");
    expect(indexValue(value(written), "pwned")).toBeNull();
  });
});
