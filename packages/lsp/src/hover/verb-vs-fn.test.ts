import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

const SOURCE = `import { http } from "venn/http"

fn route(req) => req
const api = http.serve { port: 0 }
http.on api req => route(req)
`;

async function hoverAt(needle: string): Promise<string> {
  const { services, document, uri } = await fixture(SOURCE);
  const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(SOURCE.indexOf(needle)),
  });
  const contents = hover?.contents;
  return contents && typeof contents === "object" && "value" in contents
    ? String(contents.value)
    : "";
}

/**
 * A verb and a function are different things, and the hover has to say which.
 *
 * `fn route(req)` carries the word `fn` and explains itself. `http.on server
 * handler` carries nothing of the sort, so a reader sees arguments and a
 * package and cannot tell whether this is something they may hold and pass on.
 */
describe("telling a verb from a function", () => {
  it("says a verb is one, and that the program waits for it", async () => {
    const text = await hoverAt("http.on api");

    expect(text).toContain("**Verb**");
    expect(text).toContain("waits");
    expect(text).toContain("not a value");
  });

  it("leaves a function saying `fn`, as it always did", async () => {
    const text = await hoverAt("route(req) => req");

    expect(text).toContain("fn route(req)");
    expect(text).not.toContain("**Verb**");
  });
});
