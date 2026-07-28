import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

const SOURCE = `const f = print
print "oi"
`;

async function hoverAt(needle: string, into = 0): Promise<string> {
  const { services, document, uri } = await fixture(SOURCE);
  const at = SOURCE.indexOf(needle) + into;
  const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(at),
  });
  const contents = hover?.contents;
  return contents && typeof contents === "object" && "value" in contents
    ? String(contents.value)
    : "";
}

/**
 * A prelude verb described in one place.
 *
 * `print` must answer the same as a value and as a call, which is the position
 * nearly everyone writes it in. Two tables for one word will always drift.
 */
describe("the prelude explains itself once", () => {
  it("says the same thing wherever the word is written", async () => {
    const asValue = await hoverAt("= print", 2);
    const asVerb = await hoverAt('print "oi"');

    expect(asVerb).toBe(asValue);
  });

  it("names its arguments, as any other verb does", async () => {
    const text = await hoverAt('print "oi"');

    expect(text).toContain("Arguments");
    expect(text).toContain("values");
    expect(text).toContain("print(…) -> null");
  });
});
