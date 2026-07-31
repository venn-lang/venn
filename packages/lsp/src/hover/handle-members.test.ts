import { describe, expect, it } from "vitest";
import type { CompletionItem } from "vscode-languageserver";
import { fixture } from "../testing/lsp-fixture.js";

const SOURCE = `import { http } from "venn/http"

const api = http.serve { port: 0 }
defer { api.close() }
`;

async function hoverAt(needle: string, into: number): Promise<string> {
  const { services, document, uri } = await fixture(SOURCE);
  const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(SOURCE.indexOf(needle) + into),
  });
  const contents = hover?.contents;
  return contents && typeof contents === "object" && "value" in contents
    ? String(contents.value)
    : "";
}

async function membersAfter(needle: string, into: number): Promise<CompletionItem[]> {
  const { services, document, uri } = await fixture(SOURCE);
  const list = await services.lsp.CompletionProvider?.getCompletion(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(SOURCE.indexOf(needle) + into),
  });
  return list?.items ?? [];
}

/**
 * What a plugin's handle offers, and only that.
 *
 * `http.Server` publishes its members, so the editor can describe `api.close`
 * and offer it after `api.`. An opaque name with no inside would leave both
 * silent.
 */
describe("the members of a handle", () => {
  it("describes the verb the handle publishes", async () => {
    expect(await hoverAt("api.close()", 4)).toContain("close: fn() -> void");
  });

  it("offers them, and nothing a map answers to", async () => {
    const labels = (await membersAfter("api.close()", 4)).map((each) => each.label);

    expect(labels).toEqual(["port", "close"]);
  });
});
