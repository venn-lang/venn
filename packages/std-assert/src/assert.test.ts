import type { MatcherContext, MatcherDefinition, MatcherDetail } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { assertMatchers } from "./matchers/index.js";

/**
 * A stand-in for the renderer the runtime hands a matcher, marked so that a
 * value written by anything else stands out. It is deliberately not the
 * language's renderer: this package cannot reach `core`, and what the messages
 * below hold is that the line writes with whatever it was handed rather than
 * with a definition of its own.
 */
function show(value: unknown): string {
  return `‹${JSON.stringify(value) ?? String(value)}›`;
}

const ctx: MatcherContext = { log: () => {}, show };

function matcherOf(name: string): MatcherDefinition {
  const matcher = assertMatchers.find((candidate) => candidate.name === name);
  if (!matcher) throw new Error(`no matcher ${name}`);
  return matcher;
}

function run(name: string, subject: unknown, args: unknown[], params: unknown = {}): boolean {
  return matcherOf(name).test({ subject, args, params }) as boolean;
}

function message(name: string, subject: unknown, args: unknown[], params: unknown = {}): string {
  return matcherOf(name).message({ subject, args, params }, ctx);
}

function detail(name: string, subject: unknown, args: unknown[]): MatcherDetail | undefined {
  return matcherOf(name).detail?.({ subject, args, params: {} }, ctx);
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

/**
 * A failure title writes its values with the renderer it was handed, never with
 * one of its own. It had one: strings quoted, structures as compact JSON, a
 * fallback describing a value by its shape. So `{ hits: 0 }` read as
 * `{"hits":0}` in a red assertion and as `{ hits: 0 }` from the `print` on the
 * line above, and the reader of the two was somebody who already did not
 * understand what had happened.
 *
 * Every expectation below is written against `show` rather than as the text it
 * produces, because what is being held is that the line defers. Naming the text
 * would go green on the day the line grew a renderer that happened to agree.
 */
describe("failure messages", () => {
  const PAIRS: Array<[unknown, unknown]> = [
    [{ status: "pending" }, { status: "paid" }],
    [{ user: { name: "ada" } }, { user: { name: "bob" } }],
    [[1, 2], [3]],
    [500, 204],
    [true, false],
    [null, 1],
  ];

  for (const [subject, other] of PAIRS) {
    it(`writes ${show(subject)} with the renderer it was handed`, () => {
      expect(message("equals", subject, [other])).toBe(
        `expected ${show(subject)} to equal ${show(other)}`,
      );
    });
  }

  /**
   * The budget is the one thing the line still decides for itself: a title is
   * one line and `print` has no such limit. It cuts what `show` wrote, though,
   * rather than replacing it with prose about the value's shape, so the two
   * still agree about what the value looks like as far as the line goes.
   */
  it("cuts a value past the line's budget out of what show wrote", () => {
    const big = Object.fromEntries(Array.from({ length: 12 }, (_, n) => [`f${n}`, n]));

    expect(message("equals", big, [1])).toBe(
      `expected ${show(big).slice(0, 44)}… to equal ${show(1)}`,
    );
  });

  /**
   * Both sides used to be summarised together whenever either overran, so that
   * one spelled out beside one described by its shape would not read as a
   * reporter glitch. Cutting cannot produce that mismatch: a side that fits is
   * whole, a side that does not is the start of the same text.
   */
  it("leaves the side that fits alone", () => {
    const long = { id: "ord_8812", status: "pending", total: 99, note: "paid on the second try" };
    const short = { id: "ord_8812" };

    expect(message("equals", long, [short])).toBe(
      `expected ${show(long).slice(0, 44)}… to equal ${show(short)}`,
    );
  });

  it('quotes strings so `"200"` never reads as `200`', () => {
    expect(message("equals", "200", [200])).toBe(`expected "200" to equal ${show(200)}`);
  });

  it("names the options instead of calling them `the options`", () => {
    expect(message("oneOf", 500, [[200, 204]])).toBe(
      `expected ${show(500)} to be one of ${show([200, 204])}`,
    );
  });

  it("states the tolerance closeTo used", () => {
    expect(message("closeTo", 99.5, [99.0], { within: 0.01 })).toBe(
      `expected ${show(99.5)} to be within 0.01 of ${show(99)}`,
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
