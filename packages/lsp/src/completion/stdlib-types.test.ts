import { describe, expect, it } from "vitest";
import type { CompletionItem } from "vscode-languageserver";
import { fixture } from "../testing/lsp-fixture.js";

/**
 * The editor's side of the type catalog: what a value published by a plugin
 * offers after a dot, with nothing annotated anywhere in the file.
 */
async function completeAfter(source: string, needle: string): Promise<CompletionItem[]> {
  const { services, document, uri } = await fixture(source);
  const at = document.textDocument.getText().indexOf(needle) + needle.length;
  const list = await services.lsp.CompletionProvider?.getCompletion(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(at),
  });
  return list?.items ?? [];
}

const SERVER = [
  'use "@venn/http"',
  "const api = http.serve { port: 0 }",
  "http.on api req => req.",
].join("\n");

describe("stdlib types in the editor", () => {
  // The question that started this: what does `req` have inside it?
  it("offers a request's fields to a handler nobody annotated", async () => {
    const labels = (await completeAfter(SERVER, "req => req.")).map((item) => item.label);

    expect(labels).toContain("method");
    expect(labels).toContain("url");
    expect(labels).toContain("headers");
    expect(labels).toContain("body");
  });

  it("shows the field's own type, not just its name", async () => {
    const items = await completeAfter(SERVER, "req => req.");

    expect(items.find((item) => item.label === "url")?.detail).toBe("string");
  });

  it("offers what a response carries", async () => {
    const source = ['use "@venn/http"', 'const res = http.get "https://x.test"', "res."].join("\n");

    const labels = (await completeAfter(source, "\nres.")).map((item) => item.label);

    expect(labels).toContain("status");
    expect(labels).toContain("json");
  });

  it("offers a request's fields inside a named fn that annotated it", async () => {
    const source = [
      'use "@venn/http"',
      "fn route(req: http.Request) {",
      "  const path = req.",
      "}",
    ].join("\n");

    const labels = (await completeAfter(source, "const path = req.")).map((item) => item.label);

    expect(labels).toContain("url");
    expect(labels).toContain("method");
  });

  // A namespace deals in things, not only in verbs, and those things are what
  // an annotation is written with.
  it("offers a namespace's published types beside its verbs", async () => {
    const items = await completeAfter('use "@venn/http"\nhttp.', "\nhttp.");
    const labels = items.map((item) => item.label);

    expect(labels).toContain("serve");
    expect(labels).toContain("Request");
    expect(labels).toContain("Server");
    expect(items.find((item) => item.label === "Request")?.detail).toContain("url: string");
  });

  /**
   * A handle publishes a surface and hides an inside. Publishing nothing leaves
   * `api.close()`, the way a program gives the socket back, invisible to the
   * editor that is supposed to teach it.
   */
  it("offers what the handle publishes, and nothing a map answers to", async () => {
    const source = ['use "@venn/http"', "const api = http.serve { port: 0 }", "api."].join("\n");

    const labels = (await completeAfter(source, "\napi.")).map((item) => item.label);

    expect(labels).toEqual(["port", "close"]);
  });
});
