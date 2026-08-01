import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "../registry/index.js";
import { collectFragments } from "../scheduler/index.js";
import { checkDocument } from "./check-document.js";

function problems(source: string) {
  const document = parse(source).ast;
  const registry = buildRegistry({ plugins: [], caps: createTestHost().caps });
  return checkDocument({
    document,
    registry,
    fragments: new Set(collectFragments(document).keys()),
  });
}

const codes = (source: string): string[] => problems(source).map((one) => one.code);

/**
 * `??` written next to `||` or `&&`.
 *
 * `a || b ?? c` reads as `(a || b) ?? c` and `a ?? b || c` as `a ?? (b || c)`.
 * Both parse, both answer differently, and nothing in the line says which
 * reading is which.
 */
describe("mixing the coalescing operator with the logical ones", () => {
  it("is refused with the or on the left", () => {
    expect(codes('const x = a || b ?? "c"')).toContain("VN1003");
  });

  it("is refused with the or on the right", () => {
    expect(codes('const x = a ?? b || "c"')).toContain("VN1003");
  });

  it("is refused for and as well", () => {
    expect(codes('const x = a && b ?? "c"')).toContain("VN1003");
  });

  it("is accepted once one of them is bracketed", () => {
    expect(codes('const x = (a || b) ?? "c"')).not.toContain("VN1003");
    expect(codes('const x = a ?? (b || "c")')).not.toContain("VN1003");
  });

  it("leaves each operator alone with its own kind", () => {
    expect(codes('const x = a ?? b ?? "c"')).not.toContain("VN1003");
    expect(codes('const x = a || b || "c"')).not.toContain("VN1003");
    expect(codes('const x = a && b || "c"')).not.toContain("VN1003");
  });

  it("says both readings, in the order the line has them", () => {
    const left = problems('const x = a || b ?? "c"')[0];
    const right = problems('const x = a ?? b || "c"')[0];

    expect(left?.help).toContain("(a || b) ?? c");
    expect(right?.help).toContain("a ?? (b || c)");
  });
});
