import { describe, expect, it } from "vitest";
import { buildDiff } from "./build-diff.js";
import { formatValue } from "./format-value.js";

function fields(diff: ReturnType<typeof buildDiff>) {
  if (diff.kind !== "fields") throw new Error(`expected a fields diff, got ${diff.kind}`);
  return diff;
}

describe("buildDiff", () => {
  it("names the field that moved, and keeps the ones that did not", () => {
    const diff = fields(
      buildDiff({
        label: "row",
        expected: { id: "ord_8812", status: "paid", total: 99 },
        actual: { id: "ord_8812", status: "pending", total: 99 },
      }),
    );

    expect(diff.label).toBe("row");
    expect(diff.entries).toEqual([
      { path: ".id", expected: '"ord_8812"', actual: '"ord_8812"', same: true },
      { path: ".status", expected: '"paid"', actual: '"pending"', same: false },
      { path: ".total", expected: "99", actual: "99", same: true },
    ]);
  });

  it("walks lists by position and marks a missing one absent", () => {
    const diff = fields(buildDiff({ label: "xs", expected: [1, 2, 3], actual: [1, 9] }));

    expect(diff.entries).toEqual([
      { path: "[0]", expected: "1", actual: "1", same: true },
      { path: "[1]", expected: "2", actual: "9", same: false },
      { path: "[2]", expected: "3", actual: "absent", same: false },
    ]);
  });

  it("descends into the nested field, not into the untouched one", () => {
    const diff = fields(
      buildDiff({
        label: "res",
        expected: { body: { user: { name: "ada" } }, meta: { page: 1 } },
        actual: { body: { user: { name: "grace" } }, meta: { page: 1 } },
      }),
    );

    expect(diff.entries.map((entry) => entry.path)).toEqual([".body.user.name", ".meta"]);
    expect(diff.entries[1]?.same).toBe(true);
  });

  it("leaves unaligned sides as a plain pair, inventing no field-by-field match", () => {
    // `expect ids contains [5, 6]` holds the needle against every item, so
    // "[0] expected 5, actual [1,2]" would name a mismatch nobody checked.
    expect(
      buildDiff({
        label: "ids",
        expected: [5, 6],
        actual: [
          [1, 2],
          [3, 4],
        ],
        aligned: false,
      }),
    ).toEqual({ kind: "scalar", expected: "[5, 6]", actual: "[[1, 2], [3, 4]]" });
  });

  it("stops descending into a value that contains itself", () => {
    const expected: Record<string, unknown> = {};
    expected.self = expected;
    const actual: Record<string, unknown> = { extra: 1 };
    actual.self = actual;

    const diff = fields(buildDiff({ label: "c", expected, actual }));

    expect(diff.entries.length).toBeGreaterThan(0);
    expect(diff.entries.every((entry) => !entry.expected.includes("[object"))).toBe(true);
  });

  it("falls back to a plain pair when the sides are not the same shape", () => {
    expect(buildDiff({ label: "x", expected: 200, actual: 404 })).toEqual({
      kind: "scalar",
      expected: "200",
      actual: "404",
    });
    expect(buildDiff({ label: "x", expected: [200, 204], actual: 500 })).toEqual({
      kind: "scalar",
      expected: "[200, 204]",
      actual: "500",
    });
  });
});

describe("formatValue", () => {
  it('quotes strings so `"1"` never reads as `1`', () => {
    expect(formatValue("1")).toBe('"1"');
    expect(formatValue(1)).toBe("1");
  });

  it("never renders a structure as [object Object]", () => {
    expect(formatValue({ a: 1 })).toBe("{ a: 1 }");
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(formatValue(cyclic)).toBe("{ a: 1, self: <circular> }");
  });

  it("distinguishes a missing field from a null one", () => {
    expect(formatValue(undefined)).toBe("absent");
    expect(formatValue(null)).toBe("null");
  });
});
