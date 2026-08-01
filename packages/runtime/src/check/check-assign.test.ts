import { createTestHost } from "@venn-lang/contracts";
import { checkTypes, parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../registry/index.js";
import { collectFragments } from "../scheduler/index.js";
import { checkDocument } from "./check-document.js";

/** Both passes, because both are what `venn check` runs over a file. */
function problems(source: string) {
  const document = parse(source).ast;
  const registry = buildRegistry({ plugins: [], caps: createTestHost().caps });
  const found = checkDocument({
    document,
    registry,
    fragments: new Set(collectFragments(document).keys()),
  });
  return [...found, ...checkTypes(document).problems];
}

const codes = (source: string): string[] => problems(source).map((one) => one.code);

/**
 * What `const` is for.
 *
 * Until a name could be given a new value, `let` and `const` differed in
 * nothing, and there was no reason to choose between them. This refusal is the
 * whole of what `const` promises.
 */
describe("writing to a name that was fixed", () => {
  it("is refused for a const", () => {
    expect(codes("const total = 0\ntotal = 5\nprint total")).toEqual(["VN2022"]);
  });

  it("says which word to write instead", () => {
    const [found] = problems("const total = 0\ntotal = 5\nprint total");

    expect(found?.help).toContain("`let`");
  });

  it("is allowed for a let", () => {
    expect(codes("let total = 0\ntotal = 5\nprint total")).toEqual([]);
  });

  /** `const m` says `m` names one map, not that the map never changes. */
  it("is allowed into a field of a const", () => {
    expect(codes("const m = { a: 1 }\nm.a = 2\nprint m.a")).toEqual([]);
  });

  it("is allowed into an item of a const", () => {
    expect(codes("const xs = [1]\nxs[0] = 2\nprint xs")).toEqual([]);
  });
});

describe("writing something that does not fit", () => {
  it("is refused, naming both types", () => {
    const [found] = problems('let n = 1\nn = "text"\nprint n');

    expect(found?.code).toBe("VN3010");
    expect(found?.title).toBe("Type mismatch: expected number, found string.");
  });

  it("is refused into a field, by the same rule", () => {
    expect(codes('const m = { a: 1 }\nm.a = "text"\nprint m')).toEqual(["VN3010"]);
  });

  it("says nothing when it fits", () => {
    expect(codes("let n = 1\nn = 2\nprint n")).toEqual([]);
  });
});
