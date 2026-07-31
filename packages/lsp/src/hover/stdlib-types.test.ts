import { describe, expect, it } from "vitest";
import { fixture, positionOf } from "../testing/lsp-fixture.js";

/** What the editor says about the token where `needle` starts. */
async function hoverOn(source: string, needle: string): Promise<string> {
  const { services, document, uri } = await fixture(source);
  const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
    textDocument: { uri },
    position: positionOf(document, needle),
  });
  const contents = hover?.contents as { value?: string } | undefined;
  return contents?.value ?? "";
}

describe("hover, with the stdlib's own types", () => {
  // A handler is a function expression, so the verb that takes it says what its
  // parameter is: the same rule TypeScript calls contextual typing.
  it("types a handler's parameter from the verb it is passed to", async () => {
    const source = [
      'import { http } from "venn/http"',
      "const api = http.serve { port: 0 }",
      "http.on api req => req",
    ].join("\n");

    expect(await hoverOn(source, "req => req")).toContain("method");
  });

  /**
   * A named `fn` is not written in the place it is called, so nothing can tell
   * it what it takes. Annotating is the answer, and the name resolves through
   * the plugin's published types.
   */
  it("types an annotated parameter of a named fn through the catalog", async () => {
    const source = [
      'import { http } from "venn/http"',
      "fn route(req: http.Request) => req.url",
      "const api = http.serve { port: 0 }",
      "http.on api r => route(r)",
    ].join("\n");

    const hover = await hoverOn(source, "req: http.Request");
    expect(hover).toContain("method");
    expect(hover).toContain("url");
  });

  it("types a binding by the verb that opened it", async () => {
    const source = ['import { http } from "venn/http"', "const api = http.serve { port: 0 }"].join(
      "\n",
    );

    expect(await hoverOn(source, "api = http")).toContain("http.Server");
  });
});
