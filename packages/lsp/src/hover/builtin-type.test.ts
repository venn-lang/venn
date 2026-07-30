import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

const SOURCE = `type Preco {
  id: string
  valor: number
  prazo: duration
  bruto: dynamic
  achado: string | null
}
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
 * The types the language brings with it, able to explain themselves.
 *
 * The first line anyone writes in a `type` block is made of these words, so
 * they must not be the least explained ones in the language.
 */
describe("hovering a built-in type", () => {
  it("says what it is and how it is written", async () => {
    const text = await hoverOn("string");

    expect(text).toContain("Text.");
    expect(text).toContain("name: string");
    expect(text).toContain("**Built in**");
  });

  it("explains the ones nobody could guess", async () => {
    expect(await hoverOn("duration")).toContain("500ms");
    expect(await hoverOn("dynamic")).toContain("Name a type");
  });

  it("still describes a number", async () => {
    expect(await hoverOn("number")).toContain("no separate integer type");
  });

  /** `null` is a keyword, so it reaches the hover as its own kind of node. */
  it("explains the one written as a keyword", async () => {
    const text = await hoverOn("null");

    expect(text).toContain("The absence of a value");
    expect(text).toContain("found: string | null");
  });
});
