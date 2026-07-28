import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

async function hoverAt(source: string, needle: string): Promise<string> {
  const { services, document, uri } = await fixture(source);
  const at = document.textDocument.getText().indexOf(needle);
  const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(at),
  });
  const contents = (hover as { contents?: { value?: unknown } })?.contents;
  return String(contents?.value ?? "");
}

const lines = (...source: string[]): string => source.join("\n");

/**
 * Nothing in the source says a function waits: the runtime works it out and
 * the word `async` is never written. The editor is the only place a reader can
 * find out, so it has to say so.
 */
describe("a function that waits", () => {
  it("says so, and marks the arrow", async () => {
    const text = await hoverAt(
      lines('use "venn/http"', "fn fetchIt(url) => http.get(url)", 'print fetchIt("u")'),
      "fetchIt(url)",
    );

    expect(text).toContain("Waits");
    expect(text).toContain("~>");
  });

  it("says nothing about one that does not", async () => {
    const text = await hoverAt(lines("fn double(x) => x * 2", "print double(21)"), "double(x)");

    expect(text).not.toContain("Waits");
    expect(text).toContain("->");
  });

  // The reason this is worth computing rather than reading off the source: the
  // waiting travels outwards, and only the outermost call is what anyone writes.
  it("follows the wait out through the callers", async () => {
    const source = lines(
      'use "venn/http"',
      "fn inner(url) => http.get(url)",
      "fn middle(url) => inner(url)",
      "fn outer(url) => middle(url)",
      'print outer("u")',
    );

    expect(await hoverAt(source, "outer(url)")).toContain("Waits");
    expect(await hoverAt(source, "middle(url)")).toContain("Waits");
  });

  it("leaves a chain of plain functions alone", async () => {
    const source = lines("fn a(x) => x + 1", "fn b(x) => a(x)", "print b(1)");

    expect(await hoverAt(source, "b(x)")).not.toContain("Waits");
  });
});
