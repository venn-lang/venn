import { describe, expect, it } from "vitest";
import type { CompletionItem } from "vscode-languageserver";
import { fixture } from "../testing/lsp-fixture.js";

async function membersAfter(source: string, needle: string): Promise<CompletionItem[]> {
  const { services, document, uri } = await fixture(source);
  const at = document.textDocument.getText().indexOf(needle) + needle.length;
  const list = await services.lsp.CompletionProvider?.getCompletion(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(at),
  });
  return list?.items ?? [];
}

const labelsAfter = async (source: string, needle: string): Promise<string[]> =>
  (await membersAfter(source, needle)).map((entry) => entry.label);

/**
 * The kinds are types, so the editor knows a decorator's target the way it
 * knows any other value. That is the whole reason to publish them rather than
 * keep a table of node names somewhere in the compiler.
 */
describe("what a deco's target offers", () => {
  it("completes the verbs the declared kind has", async () => {
    const labels = await labelsAfter("deco memoize(target: Fn) {\n  target.\n}\n", "  target.");

    expect(labels).toContain("wrap");
    expect(labels).toContain("addParam");
    expect(labels).toContain("meta");
  });

  it("does not offer a flow the verbs only a function has", async () => {
    const labels = await labelsAfter("deco tag(target: Flow) {\n  target.\n}\n", "  target.");

    expect(labels).toContain("title");
    expect(labels).toContain("before");
    expect(labels).not.toContain("addParam");
    expect(labels).not.toContain("wrap");
  });

  it("shows what each verb takes", async () => {
    const items = await membersAfter("deco memoize(target: Fn) {\n  target.\n}\n", "  target.");

    expect(items.find((entry) => entry.label === "params")?.detail).toBe("list<string>");
    expect(items.find((entry) => entry.label === "addParam")?.detail).toBe("fn(string) -> null");
  });
});
