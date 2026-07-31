import { describe, expect, it } from "vitest";
import { type CompletionItem, CompletionItemKind } from "vscode-languageserver";
import { fixture } from "../testing/lsp-fixture.js";

const SOURCE = `import { http } from "venn/http"

type Preco { id: number, price: number }
type Corpo { status: string, data: list<Preco> }

const response = http.get("https://x")
const body: Corpo = response.json
print body.data[0].
print body.
`;

/** What the editor offers after a dot, in the order it will show it. */
async function afterDot(needle: string): Promise<CompletionItem[]> {
  const { services, document, uri } = await fixture(SOURCE);
  const list = await services.lsp.CompletionProvider?.getCompletion(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(SOURCE.indexOf(needle) + needle.length),
  });
  return [...(list?.items ?? [])].sort((a, b) =>
    (a.sortText ?? a.label).localeCompare(b.sortText ?? b.label),
  );
}

function kindOf(items: CompletionItem[], label: string): CompletionItemKind | undefined {
  return items.find((each) => each.label === label)?.kind;
}

/**
 * What a value is comes before what every value of its kind can do.
 *
 * Sorted together alphabetically, the two fields of a record sink beneath the
 * built-ins identical on every map in the language, so someone who typed
 * `price.` is shown `average` and `chunk` and has to hunt for `id`.
 */
describe("the order of what follows a dot", () => {
  it("puts the value's own fields first", async () => {
    const labels = (await afterDot("print body.data[0].")).map((each) => each.label);

    expect(labels.slice(0, 2)).toEqual(["id", "price"]);
  });

  it("does the same for a record of records", async () => {
    const labels = (await afterDot("print body.")).map((each) => each.label);

    expect(labels.slice(0, 2)).toEqual(["data", "status"]);
  });

  /**
   * Three things, three icons, and the line that matters most is drawn at the
   * syntax: a method needs `(…)` and nothing else does, so an icon that invited
   * `xs.len()` would be inviting an error.
   */
  it("tells data from something computed from something called", async () => {
    const items = await afterDot("print body.");

    // Data the value carries.
    expect(kindOf(items, "data")).toBe(CompletionItemKind.Field);
    // Computed on every read, still written bare.
    expect(kindOf(items, "keys")).toBe(CompletionItemKind.Property);
    expect(kindOf(items, "isEmpty")).toBe(CompletionItemKind.Property);
    // Written with brackets.
    expect(kindOf(items, "get")).toBe(CompletionItemKind.Method);
    expect(kindOf(items, "merge")).toBe(CompletionItemKind.Method);
  });
});
