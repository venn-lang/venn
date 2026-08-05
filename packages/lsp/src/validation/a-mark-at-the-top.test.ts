import { describe, expect, it } from "vitest";
import { applyEdits, fixture, positionOf } from "../testing/index.js";

const BOM = "\ufeff";

/** A mistake on line one, which is the only line a mark is felt on. */
const SOURCE = "print nope";

/** What each diagnostic covers, read back out of the very text the editor holds. */
async function covered(source: string): Promise<string[]> {
  const { document } = await fixture(source);
  const text = document.textDocument;
  return (document.diagnostics ?? []).map((one) => text.getText(one.range));
}

/** Where each diagnostic starts, in the protocol's 0-based line and character. */
async function starts(source: string): Promise<string[]> {
  const { document } = await fixture(source);
  return (document.diagnostics ?? []).map(
    (one) => `${one.range.start.line}:${one.range.start.character}`,
  );
}

/** The name a rename is driven over, written twice so both uses have to move. */
const NAMED = "const alpha = 1\nprint alpha";

/** What F2 leaves behind, through the very provider the editor calls. */
async function renamed(source: string): Promise<string> {
  const { services, document, uri } = await fixture(source);
  const edit = await services.lsp.RenameProvider?.rename(document, {
    textDocument: { uri },
    position: positionOf(document, "alpha"),
    newName: "beta",
  });
  return applyEdits(document, edit?.changes?.[uri] ?? []);
}

/**
 * A mark at the top is a character the file has and the editor hides, and the
 * two surfaces answer to different halves of it: a column is what a person
 * reads beside a file name, and a range is turned back into a position against
 * the document's own text, mark and all. Moving the column at the Problem
 * boundary is what keeps both right; moving it on the token traded the second
 * for the first, because every range an editor acts on is built from those.
 */
describe("a document that opens with a byte-order mark", () => {
  it("puts the range over the very text the mistake is in", async () => {
    expect(await covered(SOURCE)).toEqual(["nope"]);
    expect(await covered(BOM + SOURCE)).toEqual(await covered(SOURCE));
  });

  it("counts the mark in that position, because the document holds it", async () => {
    expect(await starts(BOM + SOURCE)).toEqual(["0:7"]);
    expect(await starts(SOURCE)).toEqual(["0:6"]);
  });
});

/**
 * Diagnostics alone cannot prove any of it: they are the one surface built from
 * the offset. Every other one reads `$cstNode.range`, and rename is the one
 * that writes the file, so a range one place off its offset rewrote five
 * characters beside the name and left `constbetaa = 1` behind.
 */
describe("renaming in a document that opens with a byte-order mark", () => {
  it("rewrites the same text, mark or no mark", async () => {
    expect(await renamed(NAMED)).toBe("const beta = 1\nprint beta");
    expect(await renamed(BOM + NAMED)).toBe(`${BOM}const beta = 1\nprint beta`);
  });
});
