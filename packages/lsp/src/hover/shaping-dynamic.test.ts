import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

const SOURCE = `use "@venn/http"

const response = http.get("https://x")
print response.json
print response.body
print response.ok
`;

async function hoverOn(needle: string): Promise<string> {
  const { services, document, uri } = await fixture(SOURCE);
  const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(SOURCE.indexOf(needle) + 10),
  });
  const contents = hover?.contents;
  return contents && typeof contents === "object" && "value" in contents
    ? String(contents.value)
    : "";
}

/**
 * What a response actually carries, and what to do with the one part of it
 * nothing can know.
 *
 * The published type has to match the runtime: `body` is always a string, and
 * `ok` and `time` are always there. `json` is the honest `dynamic`, whatever
 * the far end sent, so the hover has to say how to give it a shape.
 */
describe("the shape of a response", () => {
  it("says the body is text, because it always is", async () => {
    expect(await hoverOn("response.body")).toContain("body: string");
  });

  it("carries what the runtime carries", async () => {
    expect(await hoverOn("response.ok")).toContain("ok: bool");
    expect(await hoverOn("response.body")).toContain("time: number");
  });

  it("leaves the parsed body unknown, because it is", async () => {
    expect(await hoverOn("response.json")).toContain("json: dynamic");
  });

  it("says how to give the unknown a shape", async () => {
    const text = await hoverOn("response.json");

    expect(text).toContain("Shape it by naming one");
    expect(text).toContain("const price: Price = res.json");
  });

  it("says nothing of the sort where the type is already known", async () => {
    expect(await hoverOn("response.body")).not.toContain("Shape it by naming one");
  });
});
