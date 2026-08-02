import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

const SOURCE = `import { regex } from "venn/regex"
import { http } from "venn/http"

const p = regex(r"a")
http.get "https://example.com"
`;

async function hoverOn(needle: string): Promise<string> {
  const { services, document, uri } = await fixture(SOURCE);
  const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(SOURCE.indexOf(needle) + 1),
  });
  const contents = hover?.contents;
  return contents && typeof contents === "object" && "value" in contents
    ? String(contents.value)
    : "";
}

/**
 * What separates a signature from the sentence explaining it.
 *
 * A line reading `` `pattern`: `string`, The pattern. `` is a list of two
 * things, which is not what it means. It got there when the dash the charter
 * forbids was swept out of the whole repository and this one was turned into a
 * comma, because nothing here read the words a person sees.
 */
describe("the line an argument is written on", () => {
  it("closes the signature before the sentence begins", async () => {
    const said = await hoverOn("regex(");

    expect(said).toContain("`pattern`");
    expect(said).not.toMatch(/`\s*,\s+[A-Z]/);
  });

  it("says what the argument is for", async () => {
    expect(await hoverOn("regex(")).toMatch(/`pattern`: `string`\. [A-Z]/);
  });

  it("does the same for a verb's arguments", async () => {
    const said = await hoverOn("http.get");

    expect(said).not.toMatch(/`\s*,\s+[A-Z]/);
  });
});
