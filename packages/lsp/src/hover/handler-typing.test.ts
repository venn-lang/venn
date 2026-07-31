import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

/** How `route`'s parameter is typed when the handler is passed this way. */
async function paramOf(line: string): Promise<string> {
  const source = [
    'import { http } from "venn/http"',
    "",
    "const api = http.serve { port: 0 }",
    line,
    "",
    "fn route(req) => req.url",
    "",
  ].join("\n");
  const { services, document, uri } = await fixture(source);
  const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(source.indexOf("fn route(req)") + 9),
  });
  const contents = hover?.contents;
  return contents && typeof contents === "object" && "value" in contents
    ? String(contents.value)
    : "";
}

/**
 * A handler learns what it is handed from the verb that will call it, however
 * the call was written.
 *
 * Inline, by name without brackets, or by name with brackets. The checker has
 * to look inside the brackets as well as at the bare arguments hanging off the
 * statement, or `http.on(api, route)` reads as a call with no arguments.
 */
describe("what a handler learns from the verb that calls it", () => {
  it("types the parameter when the handler is written inline", async () => {
    expect(await paramOf("http.on api req => route(req)")).toContain("url: string");
  });

  it("types it when the handler is passed by name, without brackets", async () => {
    expect(await paramOf("http.on api route")).toContain("url: string");
  });

  it("types it when the handler is passed by name, with brackets", async () => {
    expect(await paramOf("http.on(api, route)")).toContain("url: string");
  });
});
