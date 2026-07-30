import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

/** What the editor offers at `▮`. */
async function offeredAt(whole: string): Promise<string[]> {
  const { services, document, uri } = await fixture(whole.replace("▮", ""));
  const list = await services.lsp.CompletionProvider?.getCompletion(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(whole.indexOf("▮")),
  });
  return (list?.items ?? []).map((each) => each.label);
}

/**
 * A pattern binds several names at once, and the editor has to know each of
 * them: they are what the code after it reads.
 */
describe("names a pattern put in scope", () => {
  it("offers what a binding took apart", async () => {
    const offered = await offeredAt('const { id, total } = { id: "a", total: 1 }\n▮\n');

    expect(offered).toContain("id");
    expect(offered).toContain("total");
  });

  it("offers what a loop variable took apart", async () => {
    const offered = await offeredAt('forEach { name } in [{ name: "ana" }] {\n  ▮\n}\n');

    expect(offered).toContain("name");
  });

  it("offers what a parameter took apart", async () => {
    const offered = await offeredAt("fragment show({ name }) {\n  ▮\n}\n");

    expect(offered).toContain("name");
  });

  it("offers the name a field was bound under, not the field", async () => {
    const offered = await offeredAt('const { id: reference } = { id: "a" }\n▮\n');

    expect(offered).toContain("reference");
    expect(offered).not.toContain("id");
  });
});
