import { describe, expect, it } from "vitest";
import { nativeFn } from "../expr/native.types.js";
import { stringifyValue } from "./stringify-value.js";

describe("how a filled placeholder reads", () => {
  it("writes a string as it is", () => {
    expect(stringifyValue("ana")).toBe("ana");
  });

  it("writes a number and a boolean the way the language prints them", () => {
    expect(stringifyValue(42)).toBe("42");
    expect(stringifyValue(true)).toBe("true");
  });

  /** Nothing at all, since `add ` reads better than `add null`. */
  it("writes nothing for an absent value", () => {
    expect(stringifyValue(null)).toBe("");
    expect(stringifyValue(undefined)).toBe("");
  });

  it("keeps the unit on a value that carries one", () => {
    expect(stringifyValue({ kind: "duration", ms: 300 })).toBe("300ms");
    expect(stringifyValue({ kind: "size", bytes: 2048 })).toBe("2048b");
    expect(stringifyValue({ kind: "percent", ratio: 0.5 })).toBe("50%");
  });

  it("writes a moment as the moment", () => {
    const at = { kind: "instant", epochMs: 1767225600000, iso: "2026-01-01T00:00:00.000Z" };
    expect(stringifyValue(at)).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("a value with something inside it", () => {
  it("writes a list the way a list is written", () => {
    expect(stringifyValue([1, 2])).toBe("[1, 2]");
    expect(stringifyValue([])).toBe("[]");
  });

  it("quotes the strings inside, so a list of words reads as one value", () => {
    expect(stringifyValue(["a", "b c"])).toBe('["a", "b c"]');
  });

  it("writes a map the way a map is written", () => {
    expect(stringifyValue({ hits: 0, name: "ada" })).toBe('{ hits: 0, name: "ada" }');
    expect(stringifyValue({})).toBe("{}");
  });

  it("quotes a key that could not be written bare", () => {
    expect(stringifyValue({ "content-type": "text/html" })).toBe('{ "content-type": "text/html" }');
  });

  it("goes all the way down", () => {
    const value = { user: { name: "ada", tags: ["one", "two"] } };
    expect(stringifyValue(value)).toBe('{ user: { name: "ada", tags: ["one", "two"] } }');
  });

  it("writes a list of maps", () => {
    expect(stringifyValue([{ id: 1 }, { id: 2 }])).toBe("[{ id: 1 }, { id: 2 }]");
  });

  it("keeps nothing in place inside a list, which would otherwise lose its length", () => {
    expect(stringifyValue([1, null, 2])).toBe("[1, null, 2]");
  });

  it("keeps a unit and a moment inside a map", () => {
    const value = { took: { kind: "duration", ms: 300 } };
    expect(stringifyValue(value)).toBe("{ took: 300ms }");
  });
});

describe("the values that have no text of their own", () => {
  it("names a function rather than opening it up", () => {
    expect(stringifyValue(nativeFn(() => 1))).toBe("<fn>");
  });

  it("stops at a map that holds itself", () => {
    const value: Record<string, unknown> = { name: "ada" };
    value.self = value;
    expect(stringifyValue(value)).toBe('{ name: "ada", self: <circular> }');
  });

  it("writes the same value twice when it is shared and not circular", () => {
    const inner = { id: 1 };
    expect(stringifyValue([inner, inner])).toBe("[{ id: 1 }, { id: 1 }]");
  });

  it("never produces the host's own words for any of them", () => {
    const values = [{}, [], nativeFn(() => 1), { a: { b: [{}] } }, new Date(0)];
    for (const value of values) expect(stringifyValue(value)).not.toContain("[object Object]");
  });
});
