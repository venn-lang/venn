import { describe, expect, it } from "vitest";
import type { CompletionItem } from "vscode-languageserver";
import { fixture } from "../testing/lsp-fixture.js";

const SOURCE = `const people = [{ name: "Ada", age: 36 }, { name: "Grace", age: 45 }]

const seniors = people.filter(p => p.age > 35)
const pairs = people.map((person, at) => "\${at}: \${person.name}")
`;

async function hoverAt(needle: string, into = 0): Promise<string> {
  const { services, document, uri } = await fixture(SOURCE);
  const at = document.textDocument.getText().indexOf(needle) + into;
  const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(at),
  });
  const contents = hover?.contents;
  return contents && typeof contents === "object" && "value" in contents
    ? String(contents.value)
    : "";
}

async function completeAfter(needle: string): Promise<CompletionItem[]> {
  const { services, document, uri } = await fixture(SOURCE);
  const at = document.textDocument.getText().indexOf(needle) + needle.length;
  const list = await services.lsp.CompletionProvider?.getCompletion(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(at),
  });
  return list?.items ?? [];
}

/**
 * The editor knows an arrow parameter for what it is, the same as `fn (p) => …`
 * does. It is the very same node, only spelled shorter.
 */
describe("arrow functions in the editor", () => {
  it("types the parameter from what it is given", async () => {
    expect(await hoverAt("p => p.age")).toContain("name");
  });

  it("offers the parameter's members", async () => {
    const labels = (await completeAfter("p => p.")).map((entry) => entry.label);

    expect(labels).toContain("age");
    expect(labels).toContain("name");
  });

  it("types every parameter of a bracketed arrow", async () => {
    expect(await hoverAt("(person, at)", 1)).toContain("name");
    const labels = (await completeAfter("person.")).map((entry) => entry.label);
    expect(labels).toContain("name");
  });

  it("still knows where the binding came from", async () => {
    expect(await hoverAt("seniors")).toContain("list");
  });
});
