import { describe, expect, it } from "vitest";
import { forHost } from "./for-host.js";
import { invoke } from "./invoke.js";
import { nativeFn } from "./native.types.js";

/** A Venn callable, as the language holds one. */
const twice = nativeFn((values) => (values[0] as number) * 2);

/**
 * A function going the other way: from Venn into JavaScript.
 *
 * `nativeFn` wraps a host function so the language can call it, and nothing
 * wrapped one the other way. A `Closure` is a record the interpreter reads, not
 * something JavaScript can call, so handing one to a library gave it a value it
 * called anyway: `map([1, 2, 3], fn (n) => n * 2)` answered `[false, false,
 * false]`. No error, no diagnostic, three wrong numbers.
 *
 * Every `.map`, `.filter`, `.sort` and `.reduce` of every npm package was
 * broken this way, and so was every event handler, which is most of what a
 * program does with a library at all.
 */
describe("a callable handed to the host", () => {
  it("becomes a function the host can call", () => {
    const crossed = forHost(twice) as (n: number) => number;

    expect(typeof crossed).toBe("function");
    expect(crossed(3)).toBe(6);
  });

  it("carries every argument the host passes", () => {
    const joined = nativeFn((values) => values.join("/"));
    const crossed = forHost(joined) as (...parts: string[]) => string;

    expect(crossed("a", "b", "c")).toBe("a/b/c");
  });

  /** A callback is as often written inside something as passed alone. */
  it("crosses one written inside a map", () => {
    const crossed = forHost({ onEach: twice }) as { onEach: (n: number) => number };

    expect(crossed.onEach(4)).toBe(8);
  });

  it("crosses one written inside a list", () => {
    const crossed = forHost([twice, twice]) as ((n: number) => number)[];

    expect(crossed.map((one) => one(1))).toEqual([2, 2]);
  });

  it("crosses one nested two deep, since options objects nest", () => {
    const crossed = forHost({ on: { each: twice } }) as { on: { each: (n: number) => number } };

    expect(crossed.on.each(5)).toBe(10);
  });

  /**
   * Identity survives where nothing moved. A value carrying no callable is
   * handed over as itself, so a library that holds one and reads it back gets
   * the object it was given rather than a copy of it.
   */
  it("hands back the very same value when nothing inside is callable", () => {
    const held = { a: 1, b: [2, 3], c: { d: "four" } };

    expect(forHost(held)).toBe(held);
    expect(forHost(held.b)).toBe(held.b);
  });

  it("leaves what is already the host's alone", () => {
    const when = new Date(0);
    const pattern = /x/;

    expect(forHost(when)).toBe(when);
    expect(forHost(pattern)).toBe(pattern);
    expect(forHost(42)).toBe(42);
    expect(forHost(null)).toBeNull();
  });

  /** A host function handed back to the host is the host's own, untouched. */
  it("leaves a host function as it was", () => {
    const raw = (n: number): number => n + 1;

    expect(forHost(raw)).toBe(raw);
  });

  /** The round trip: out to the host, called from there, back into `invoke`. */
  it("is the same call either way round", () => {
    const crossed = forHost(twice) as (n: number) => number;

    expect(crossed(7)).toBe(invoke(twice, [7]));
  });
});
