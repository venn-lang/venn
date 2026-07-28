import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

/** The labels offered at `▮`, in the order the editor shows them. */
async function offeredAt(whole: string): Promise<string[]> {
  const { services, document, uri } = await fixture(whole.replace("▮", ""));
  const list = await services.lsp.CompletionProvider?.getCompletion(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(whole.indexOf("▮")),
  });
  return [...(list?.items ?? [])]
    .sort((a, b) => (a.sortText ?? a.label).localeCompare(b.sortText ?? b.label))
    .map((each) => each.label);
}

const USE = 'use "venn/http"\n\n';

/**
 * The first line of the first `type` anyone writes is `id: string`, so `string`
 * must not be the one word in the language that answers nothing.
 */
describe("completing a type name", () => {
  it("offers the language's own types in a type block", async () => {
    const labels = await offeredAt(`${USE}type Preco {\n  id: ▮\n}\n`);

    expect(labels).toContain("string");
    expect(labels).toContain("number");
    expect(labels).toContain("duration");
  });

  it("offers them on a parameter and on a binding too", async () => {
    expect(await offeredAt(`${USE}fn f(x: ▮) => x\n`)).toContain("string");
    expect(await offeredAt(`${USE}const a: ▮ = 1\n`)).toContain("string");
  });

  it("offers what this file declared, and what its imports publish", async () => {
    const labels = await offeredAt(`${USE}type Preco { id: string }\ntype Item { p: ▮ }\n`);

    expect(labels).toContain("Preco");
    expect(labels).toContain("http.Response");
  });

  /** Inside a call's options a colon introduces a value, never a type. */
  it("leaves an options map alone", async () => {
    const labels = await offeredAt(`${USE}http.get "u" { headers: ▮ }\n`);

    expect(labels).not.toContain("string");
    expect(labels).toContain("headers");
  });
});
