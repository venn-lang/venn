import { EmptyFileSystem, type LangiumDocument, URI } from "langium";
import { describe, expect, it } from "vitest";
import { createVennLspServices } from "../services/index.js";
import type { VennServices } from "../services/lsp.types.js";

const A = 'flow "a" { step "s" { const xs = [1, 2, 3]\nexpect xs.len == 3 } }';
const B = 'flow "b" { step "s" { const name = "Ada"\nexpect name.upper == "ADA" } }';

/** Build a workspace of several documents, the way opening a folder does. */
async function workspace(files: Record<string, string>): Promise<{
  services: VennServices;
  documents: Record<string, LangiumDocument>;
  edit(name: string, source: string): Promise<void>;
}> {
  const { shared, Venn } = createVennLspServices(EmptyFileSystem);
  const documents: Record<string, LangiumDocument> = {};
  for (const [name, source] of Object.entries(files)) {
    const document = shared.workspace.LangiumDocumentFactory.fromString(
      source,
      URI.parse(`memory:///${name}`),
    );
    shared.workspace.LangiumDocuments.addDocument(document);
    documents[name] = document;
  }
  await shared.workspace.DocumentBuilder.build(Object.values(documents), { validation: true });
  return {
    services: Venn,
    documents,
    async edit(name, source) {
      const document = documents[name] as LangiumDocument;
      shared.workspace.LangiumDocuments.deleteDocument(document.uri);
      const next = shared.workspace.LangiumDocumentFactory.fromString(source, document.uri);
      shared.workspace.LangiumDocuments.addDocument(next);
      documents[name] = next;
      await shared.workspace.DocumentBuilder.build([next], { validation: true });
    },
  };
}

describe("the type cache", () => {
  it("is already warm for every file the workspace loaded", async () => {
    const { services, documents } = await workspace({ "a.vn": A, "b.vn": B });

    // `peek` never computes, so a hit means the build already typed them.
    expect(services.types.peek(documents["a.vn"] as LangiumDocument)).toBeDefined();
    expect(services.types.peek(documents["b.vn"] as LangiumDocument)).toBeDefined();
  });

  it("serves the same result twice instead of inferring again", async () => {
    const { services, documents } = await workspace({ "a.vn": A });
    const document = documents["a.vn"] as LangiumDocument;

    expect(services.types.of(document)).toBe(services.types.of(document));
  });

  it("re-types only the file that changed", async () => {
    const store = await workspace({ "a.vn": A, "b.vn": B });
    const before = {
      a: store.services.types.of(store.documents["a.vn"] as LangiumDocument),
      b: store.services.types.of(store.documents["b.vn"] as LangiumDocument),
    };

    await store.edit("a.vn", 'flow "a" { step "s" { const xs = ["x"]\nexpect xs.len == 1 } }');

    const after = {
      a: store.services.types.of(store.documents["a.vn"] as LangiumDocument),
      b: store.services.types.of(store.documents["b.vn"] as LangiumDocument),
    };
    expect(after.a).not.toBe(before.a);
    expect(after.b).toBe(before.b);
  });

  it("reflects the edit: the new types replace the old ones", async () => {
    const store = await workspace({ "a.vn": A });

    await store.edit("a.vn", 'flow "a" { step "s" { const xs = ["x"]\nexpect xs.len == 1 } }');
    const document = store.documents["a.vn"] as LangiumDocument;

    expect(store.services.types.of(document).problems).toEqual([]);
  });

  it("forgets a document it is told to drop", async () => {
    const { services, documents } = await workspace({ "a.vn": A });
    const document = documents["a.vn"] as LangiumDocument;

    services.types.forget(document.uri.toString());

    expect(services.types.peek(document)).toBeUndefined();
  });
});
