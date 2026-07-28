import { describe, expect, it } from "vitest";
import { combine } from "../../units/index.js";
import { INVOKE, isCallable } from "../invoke.js";
import { memberValue } from "../member-value.js";
import { nativeFn } from "../native.types.js";

/** Read a member and call it, the way an expression would. */
function call(receiver: unknown, member: string, args: readonly unknown[] = []): unknown {
  const found = memberValue(receiver, member);
  return isCallable(found) ? INVOKE(found, args) : found;
}

/**
 * The edges of the built-in members, where an answer is easy to get wrong
 * without anyone noticing. Each of these returned something plausible and
 * wrong.
 */
describe("list members at their edges", () => {
  it("takes none of a list when asked for none", () => {
    expect(call([1, 2, 3], "takeLast", [0])).toEqual([]);
    expect(call([1, 2, 3], "takeLast", [2])).toEqual([2, 3]);
  });

  /** `slice(-0)` is `slice(0)`, so asking for nothing used to give everything. */
  it("does not confuse zero with the whole list", () => {
    expect(call([1, 2, 3], "takeLast", [0])).not.toEqual([1, 2, 3]);
  });

  it("finds the smallest and largest without spreading the list", () => {
    const many = Array.from({ length: 200_000 }, (_unused, at) => at);

    expect(call(many, "max")).toBe(199_999);
    expect(call(many, "min")).toBe(0);
  });

  it("has no smallest or largest in an empty list", () => {
    expect(call([], "max")).toBeNull();
    expect(call([], "min")).toBeNull();
  });

  /** A key the function cannot render still has to be a string. */
  it("groups under a named key when the value has no rendering", () => {
    const counted = call([{ v: 1 }, { v: 2 }], "countBy", [nativeFn(() => undefined)]);

    expect(Object.keys(counted as object)).toEqual(["undefined"]);
    expect((counted as Record<string, number>).undefined).toBe(2);
  });
});

describe("a path into a map", () => {
  it("tells a field holding null apart from a field that is not there", () => {
    const map = { present: null, nested: { deep: null } };

    expect(call(map, "hasPath", ["present"])).toBe(true);
    expect(call(map, "hasPath", ["nested.deep"])).toBe(true);
    expect(call(map, "hasPath", ["absent"])).toBe(false);
    expect(call(map, "hasPath", ["nested.absent"])).toBe(false);
  });

  it("reads through to a nested value", () => {
    expect(call({ a: { b: { c: 7 } } }, "getPath", ["a.b.c"])).toBe(7);
    expect(call({ a: 1 }, "getPath", ["a.b"])).toBeNull();
  });
});

describe("comparing values whose units differ", () => {
  /**
   * Ordering two different kinds has no answer, so it reports a mismatch.
   * Asking whether they are equal has one, and it must not fail to give it.
   */
  it("answers equality instead of reporting a mismatch", () => {
    const duration = { kind: "duration", ms: 300 } as const;
    const size = { kind: "size", bytes: 2 } as const;

    expect(combine({ op: "==", left: duration, right: size })).toEqual({ ok: true, value: false });
    expect(combine({ op: "!=", left: duration, right: size })).toEqual({ ok: true, value: true });
  });

  it("still refuses to order them", () => {
    const duration = { kind: "duration", ms: 300 } as const;
    const size = { kind: "size", bytes: 2 } as const;

    expect(combine({ op: "<", left: duration, right: size }).ok).toBe(false);
  });

  it("compares two values of the same kind as usual", () => {
    const short = { kind: "duration", ms: 300 } as const;
    const long = { kind: "duration", ms: 900 } as const;

    expect(combine({ op: "==", left: short, right: long })).toEqual({ ok: true, value: false });
    expect(combine({ op: "<", left: short, right: long })).toEqual({ ok: true, value: true });
  });
});
