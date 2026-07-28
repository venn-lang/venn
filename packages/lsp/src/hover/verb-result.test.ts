import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

async function typeOf(line: string): Promise<string> {
  const source = `use "venn/http"\nuse "venn/fmt"\n\n${line}\n`;
  const { services, document, uri } = await fixture(source);
  const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(source.indexOf("const r") + 6),
  });
  const contents = hover?.contents;
  return contents && typeof contents === "object" && "value" in contents
    ? String(contents.value)
    : "";
}

async function membersOf(source: string, after: string): Promise<string[]> {
  const { services, document, uri } = await fixture(source);
  const list = await services.lsp.CompletionProvider?.getCompletion(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(source.indexOf(after) + after.length),
  });
  return (list?.items ?? []).map((each) => each.label);
}

/**
 * What a verb gives back, whichever way the call was written.
 *
 * `http.get "url"` carried the verb's type and `http.get("url")` did not: with
 * brackets it read as an ordinary call on whatever `http.get` evaluated to,
 * which is nothing the checker knows. Every result of every verb written the
 * way most people write it came back `dynamic`.
 */
describe("the type of what a verb returns", () => {
  it("is the same with brackets as without", async () => {
    const bare = await typeOf('const r = http.get "https://x"');
    const called = await typeOf('const r = http.get("https://x")');

    expect(called).toContain("status: number");
    expect(called).toBe(bare);
  });

  it("holds for a verb that gives back a scalar", async () => {
    expect(await typeOf('const r = fmt.json("x", 2)')).toContain("string");
  });

  it("holds for a verb that gives back a handle", async () => {
    expect(await typeOf("const r = http.serve { port: 0 }")).toContain("http.Server");
  });

  it("lets the editor offer what the answer carries", async () => {
    const source = 'use "venn/http"\n\nconst response = http.get("https://x")\nprint response.\n';
    const labels = await membersOf(source, "print response.");

    // Its own fields first, then what any map answers to.
    expect(labels.slice(0, 6)).toEqual(["status", "ok", "headers", "body", "json", "time"]);
  });
});
