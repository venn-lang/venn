import type { MatcherDefinition, MatcherDetail } from "@venn/sdk";
import { describe, expect, it } from "vitest";
import { assertMatchers } from "./matchers/index.js";

function matcherOf(name: string): MatcherDefinition {
  const matcher = assertMatchers.find((candidate) => candidate.name === name);
  if (!matcher) throw new Error(`no matcher ${name}`);
  return matcher;
}

function run(name: string, subject: unknown, args: unknown[], params: unknown = {}): boolean {
  return matcherOf(name).test({ subject, args, params }) as boolean;
}

function message(name: string, subject: unknown, args: unknown[], params: unknown = {}): string {
  return matcherOf(name).message({ subject, args, params });
}

function detail(name: string, subject: unknown, args: unknown[]): MatcherDetail | undefined {
  return matcherOf(name).detail?.({ subject, args, params: {} });
}

describe("assert matchers", () => {
  it("equals is strict", () => {
    expect(run("equals", 200, [200])).toBe(true);
    expect(run("equals", "200", [200])).toBe(false);
  });

  it("equals compares maps and lists by value, not by reference", () => {
    expect(run("equals", [1, 2], [[1, 2]])).toBe(true);
    expect(run("equals", { id: 1, tags: ["a"] }, [{ id: 1, tags: ["a"] }])).toBe(true);
    expect(run("equals", { id: 1 }, [{ id: 2 }])).toBe(false);
    expect(run("equals", { id: 1 }, [{ id: 1, extra: true }])).toBe(false);
  });

  it("equals treats a field set to nothing as no field at all", () => {
    // `let row = { id: src.id, ref: src.ref }` where `src` has no `ref`. Both
    // sides print `{"id":1}`; a red assertion between them explains nothing.
    expect(run("equals", { id: 1, ref: undefined }, [{ id: 1 }])).toBe(true);
    expect(run("equals", { id: 1 }, [{ id: 1, ref: undefined }])).toBe(true);
    // A field holding `null` is still a field: `null` is a value, absence is not.
    expect(run("equals", { id: 1, ref: null }, [{ id: 1 }])).toBe(false);
  });

  it("equals survives a value that contains itself", () => {
    const a: Record<string, unknown> = { n: 1 };
    a.self = a;
    const b: Record<string, unknown> = { n: 1 };
    b.self = b;
    expect(run("equals", a, [b])).toBe(true);
    expect(run("equals", a, [{ n: 2, self: {} }])).toBe(false);
  });

  it("contains handles strings and arrays", () => {
    expect(run("contains", "Total: $99.00", ["$99.00"])).toBe(true);
    expect(run("contains", [1, 2, 3], [2])).toBe(true);
    expect(run("contains", [{ id: 1 }], [{ id: 1 }])).toBe(true);
  });

  it("oneOf checks membership", () => {
    expect(run("oneOf", 204, [[200, 204]])).toBe(true);
    expect(run("oneOf", 500, [[200, 204]])).toBe(false);
    expect(run("oneOf", { a: 1 }, [[{ a: 1 }]])).toBe(true);
  });

  it("closeTo respects the tolerance", () => {
    expect(run("closeTo", 99.005, [99.0], { within: 0.01 })).toBe(true);
    expect(run("closeTo", 99.5, [99.0], { within: 0.01 })).toBe(false);
  });
});

describe("failure messages", () => {
  it("never renders a value as [object Object]", () => {
    const text = message("equals", { status: "pending" }, [{ status: "paid" }]);
    expect(text).not.toContain("[object Object]");
    expect(text).toBe('expected {"status":"pending"} to equal {"status":"paid"}');
  });

  it("describes a value too long for one line by its shape", () => {
    const big = Object.fromEntries(Array.from({ length: 12 }, (_, n) => [`f${n}`, n]));
    expect(message("equals", big, [big])).toBe(
      "expected a map with 12 fields to equal a map with 12 fields",
    );
  });

  it("summarises both sides together, never one spelled out beside one summarised", () => {
    const long = { id: "ord_8812", status: "pending", total: 99 };
    const short = { id: "ord_8812", status: "paid" };
    expect(message("equals", long, [short])).toBe(
      "expected a map with 3 fields to equal a map with 2 fields",
    );
  });

  it('quotes strings so `"200"` never reads as `200`', () => {
    expect(message("equals", "200", [200])).toBe('expected "200" to equal 200');
  });

  it("names the options instead of calling them `the options`", () => {
    expect(message("oneOf", 500, [[200, 204]])).toBe("expected 500 to be one of [200,204]");
  });

  it("states the tolerance closeTo used", () => {
    expect(message("closeTo", 99.5, [99.0], { within: 0.01 })).toBe(
      "expected 99.5 to be within 0.01 of 99",
    );
  });

  it("shows what contains was looking for, and where", () => {
    expect(message("contains", "Total: $50.00", ["$99.00"])).toBe(
      'expected "Total: $50.00" to contain "$99.00"',
    );
  });
});

describe("failure detail", () => {
  it("hands back the two sides so the failure can carry a diff", () => {
    expect(detail("equals", { status: "pending" }, [{ status: "paid" }])).toEqual({
      expected: { status: "paid" },
      actual: { status: "pending" },
    });
    expect(detail("oneOf", 500, [[200, 204]])).toEqual({
      expected: [200, 204],
      actual: 500,
      aligned: false,
    });
    expect(detail("contains", "abc", ["z"])).toEqual({
      expected: "z",
      actual: "abc",
      aligned: false,
    });
    expect(detail("closeTo", 99.5, [99.0])).toEqual({ expected: 99.0, actual: 99.5 });
  });

  it("marks membership sides unaligned: a needle never stood opposite item 0", () => {
    expect(detail("contains", [1, 2], [[3, 4]])?.aligned).toBe(false);
    expect(detail("oneOf", [9, 9], [[1, 2]])?.aligned).toBe(false);
    // `equals` does line up field by field, and says nothing.
    expect(detail("equals", { a: 1 }, [{ a: 2 }])?.aligned).toBeUndefined();
  });
});
