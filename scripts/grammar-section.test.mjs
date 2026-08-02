import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { blockIn, grammarBlock, SPEC } from "./grammar-section.mjs";

/**
 * §21 against the grammar it claims to be.
 *
 * The section is headed "this is the whole file". It held twenty-seven of the
 * seventy-six rules, listed three that had been removed, and showed `LetStmt`
 * without `pub`, without `const`, without a pattern and without a type. That is
 * three milestones missing from the document that says it is the specification.
 *
 * A skeleton kept by hand drifts, and one that drifts is worse than none: it is
 * read as authority. So the block is the grammar, and this holds it there.
 */
describe("the grammar in the specification", () => {
  it("is the grammar in the language", async () => {
    const expected = await grammarBlock();

    expect(blockIn(await readFile(SPEC, "utf8"))).toBe(expected);
  });

  /** Run `node scripts/grammar-section.mjs --write` when this fails. */
  it("says how to put it back", async () => {
    const block = await grammarBlock();

    expect(block).toContain("entry Document:");
    expect(block).not.toContain("//");
  });
});
