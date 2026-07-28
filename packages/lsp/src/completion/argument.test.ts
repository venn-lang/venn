import { describe, expect, it } from "vitest";
import type { CompletionItem } from "vscode-languageserver";
import { fixture } from "../testing/lsp-fixture.js";

// `·` is the space just typed; an editor would trim a real one away.
const SOURCE = `use "venn/http"

const api = http.serve { port: 8099 }
const address = "https://example.com"
http.on·
http.get·
print·
`.replaceAll("·", " ");

async function completeAfter(line: string): Promise<CompletionItem[]> {
  const { services, document, uri } = await fixture(SOURCE);
  const at = SOURCE.indexOf(`${line}\n`) + line.length;
  const list = await services.lsp.CompletionProvider?.getCompletion(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(at),
  });
  return list?.items ?? [];
}

/** The labels in the order the editor will show them. */
async function ranked(line: string): Promise<string[]> {
  const items = await completeAfter(line);
  return [...items]
    .sort((a, b) => (a.sortText ?? a.label).localeCompare(b.sortText ?? b.label))
    .map((each) => each.label);
}

/**
 * An argument almost always wants something the program already has. Offering
 * every loaded namespace first, as a fresh statement does, buries the one right
 * answer under dozens that cannot be.
 */
describe("completion where an argument is due", () => {
  it("offers what is in scope before what the stdlib holds", async () => {
    const labels = await ranked("http.on ");

    expect(labels.slice(0, 2)).toEqual(["api", "address"]);
    expect(labels.indexOf("http")).toBeGreaterThan(1);
  });

  it("puts the value of the right type first", async () => {
    // `http.on` wants the server; `http.get` wants the URL. Same two names.
    expect((await ranked("http.on "))[0]).toBe("api");
    expect((await ranked("http.get "))[0]).toBe("address");
  });

  it("says where each name came from, and what it holds", async () => {
    const api = (await completeAfter("http.on ")).find((each) => each.label === "api");

    expect(api?.detail).toBe("const api: http.Server");
  });

  it("answers after a prelude verb too", async () => {
    expect(await ranked("print ")).toContain("api");
  });
});
