import { describe, expect, it } from "vitest";
import { INVOKE } from "../invoke.js";
import { isPattern, pattern, REGEX_METHODS } from "./regex-methods.js";

/** Read a member the way the language does, calling it when it is a function. */
function member(source: string, name: string, arg?: string): unknown {
  const it = pattern(source);
  const value = (REGEX_METHODS[name] as (r: unknown, i: unknown) => unknown)(it, INVOKE);
  return arg === undefined ? value : INVOKE(value, [arg]);
}

describe("a compiled pattern", () => {
  it("keeps the pattern as written", () => {
    expect(member("Order #(\\d+)", "source")).toBe("Order #(\\d+)");
  });

  it("keeps its flags, and has none by default", () => {
    expect(member("a", "flags")).toBe("");
    expect(pattern("a", "gi").flags).toBe("gi");
  });

  it("answers whether it matches", () => {
    expect(member("Order #\\d+", "test", "Order #42")).toBe(true);
    expect(member("Order #\\d+", "test", "nothing")).toBe(false);
  });

  /** The whole match first, then each group, which is why one captures at all. */
  it("gives the groups of the first match", () => {
    expect(member("Order #(\\d+)", "match", "Order #42")).toEqual(["Order #42", "42"]);
  });

  /**
   * An empty list rather than null, so `.match(s).len == 0` is the question
   * without a second shape to handle.
   */
  it("gives an empty list when it does not match", () => {
    expect(member("Order #(\\d+)", "match", "nothing")).toEqual([]);
  });

  it("fills a group that took part in no match with empty text", () => {
    expect(member("(a)|(b)", "match", "b")).toEqual(["b", "", "b"]);
  });

  it("honours a flag asked for inside the pattern", () => {
    expect(member("(?i:order)", "test", "ORDER")).toBe(true);
  });

  it("refuses text that is not a pattern", () => {
    expect(() => pattern("[unclosed")).toThrow(/not a pattern/);
  });

  it("knows one of its own from anything else", () => {
    expect(isPattern(pattern("a"))).toBe(true);
    expect(isPattern("a")).toBe(false);
    expect(isPattern({ kind: "duration", ms: 1 })).toBe(false);
    expect(isPattern(null)).toBe(false);
  });
});
