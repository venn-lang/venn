import { describe, expect, it } from "vitest";
import type { Document } from "../../generated/ast.js";
import { isLetStmt } from "../../generated/ast.js";
import { parse, parseExpression } from "../../parse/index.js";
import { kindOf } from "../../value/index.js";
import { display, type EvalEnv, evaluate } from "../index.js";

/** Evaluate `expr`, with any leading `const` bindings in scope. */
function run(program: string, expr: string): unknown {
  const bindings: Record<string, unknown> = {};
  const env: EvalEnv = { lookup: (name) => bindings[name] };
  for (const decl of (parse(program).ast as Document).decls) {
    if (isLetStmt(decl) && decl.name) bindings[decl.name] = evaluate(decl.value, env);
  }
  const parsed = parseExpression(expr);
  if (!parsed) throw new Error(`could not parse: ${expr}`);
  return evaluate(parsed, env);
}

/** What a built map has to be, whatever its keys spell. */
function isAnEverydayMap(value: unknown): boolean {
  return kindOf(value) === "map" && Object.getPrototypeOf(value) === Object.prototype;
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
 * The three names that are refused as a place to write, used as data instead.
 *
 * `constructor` and `prototype` are here beside `__proto__` because reading
 * them back went wrong for a different reason: nothing inherited answers
 * `prototype`, `Object.prototype.constructor` answers a function, and the
 * accumulators read the key back before writing it.
 */
const RESERVED = ["__proto__", "constructor", "prototype"];

/**
 * A key that comes out of the data is data.
 *
 * `groupBy`, `countBy`, `keyBy`, `toMap` and `mergeDeep` all take a key from
 * whatever the user handed them: a JSON field, a header, a form value. Writing
 * it with `out[key] = ...` made `__proto__` mean "replace what this map
 * inherits from" rather than "a key called `__proto__`", so the group was lost
 * and the next read of it threw a host `TypeError` with no code and no span.
 *
 * Assignment is the other case and stays refused: `m["__proto__"] = 1` names a
 * place, and VN3023 says that place belongs to what made the value. Here the
 * user named a value, not a place.
 */
describe("a key out of the data", () => {
  const ROWS = `const rows = [
    { team: '__proto__', n: 1 },
    { team: 'red', n: 2 },
    { team: '__proto__', n: 3 }
  ]`;

  it("groups under it without losing the group", () => {
    const teams = run(ROWS, "rows.groupBy(fn (r) => r.team)") as Record<string, unknown[]>;

    expect(Object.keys(teams)).toEqual(["__proto__", "red"]);
    expect(own(teams, "__proto__")).toHaveLength(2);
    expect(isAnEverydayMap(teams)).toBe(true);
  });

  it("counts under it without dropping it", () => {
    const counted = run(ROWS, "rows.countBy(fn (r) => r.team)") as Record<string, unknown>;

    expect(Object.keys(counted)).toEqual(["__proto__", "red"]);
    expect(own(counted, "__proto__")).toBe(2);
    expect(isAnEverydayMap(counted)).toBe(true);
  });

  it("indexes under it, last one winning", () => {
    const indexed = run(ROWS, "rows.keyBy(fn (r) => r.team)") as Record<string, unknown>;

    expect(Object.keys(indexed)).toEqual(["__proto__", "red"]);
    expect(own(indexed, "__proto__")).toEqual({ team: "__proto__", n: 3 });
  });

  it.each(RESERVED)("groups under %s and reads it back", (name) => {
    const grouped = run(`const rows = [{ k: '${name}' }]`, "rows.groupBy(fn (r) => r.k)") as Record<
      string,
      unknown[]
    >;

    expect(Object.keys(grouped)).toEqual([name]);
    expect(grouped[name]).toHaveLength(1);
    expect(isAnEverydayMap(grouped)).toBe(true);
  });

  it.each(RESERVED)("counts under %s without arithmetic on the host's", (name) => {
    const counted = run(
      `const rows = [{ k: '${name}' }, { k: '${name}' }]`,
      "rows.countBy(fn (r) => r.k)",
    );

    expect(counted).toEqual(Object.fromEntries([[name, 2]]));
  });

  /**
   * Nothing inherited is a group either: these are the names that made the
   * accumulator's read answer a function rather than "no group yet".
   */
  it.each(["toString", "valueOf", "hasOwnProperty"])("groups under %s", (name) => {
    const grouped = run(`const rows = [{ k: '${name}' }]`, "rows.groupBy(fn (r) => r.k)") as Record<
      string,
      unknown[]
    >;

    expect(grouped[name]).toHaveLength(1);
  });

  it.each(RESERVED)("reads a pair naming %s back into the map", (name) => {
    const built = run("", `[['${name}', 7], ['other', 8]].toMap`) as Record<string, unknown>;

    expect(Object.keys(built)).toEqual([name, "other"]);
    expect(built[name]).toBe(7);
    expect(isAnEverydayMap(built)).toBe(true);
  });

  it.each(RESERVED)("merges a branch named %s", (name) => {
    const merged = run(
      `const cfg = { a: 1 }`,
      `cfg.mergeDeep({ '${name}': { deep: 2 } })`,
    ) as Record<string, Record<string, unknown>>;

    expect(Object.keys(merged)).toEqual(["a", name]);
    expect(merged[name]).toEqual({ deep: 2 });
    expect(isAnEverydayMap(merged)).toBe(true);
  });

  it("merges into a branch that key already names, without reaching the host's", () => {
    const merged = run(
      `const cfg = [['__proto__', { keep: 1 }]].toMap`,
      "cfg.mergeDeep({ '__proto__': { add: 2 } })",
    ) as Record<string, unknown>;

    expect(own(merged, "__proto__")).toEqual({ keep: 1, add: 2 });
  });

  /** The whole point: none of it changes what the built map inherits from. */
  it("never lets a data key reach the prototype", () => {
    const built = run("", "[['__proto__', { pwned: 7 }]].toMap") as Record<string, unknown>;

    expect(Object.hasOwn(built, "__proto__")).toBe(true);
    expect("pwned" in built).toBe(false);
    expect("pwned" in {}).toBe(false);
  });

  /**
   * The repro was `print rows.groupBy(...)`, so the group has to survive being
   * written out as well as being built.
   */
  it("writes the group out under the name the data gave it", () => {
    const written = display(run(ROWS, "rows.groupBy(fn (r) => r.team)"));

    expect(written).toContain("__proto__");
    expect(written).toContain("red");
  });
});
