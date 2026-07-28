import { describe, expect, it } from "vitest";
import type { CompletionItem, DocumentSymbol, LocationLink, Position } from "vscode-languageserver";
import { applyEdits, type Fixture, fixture, positionOf } from "../testing/lsp-fixture.js";

/** Where the cursor goes, and what the file it sits in can see. */
interface At {
  source: string;
  needle: string;
  /** Characters into the needle; `1` lands just past the `@`. */
  into?: number;
  /** Files beside this one, so an `import` resolves. */
  modules?: Record<string, string>;
}

const LOCAL = `## Remembers what it already worked out.
deco memoize(target: Fn) {
  target.meta "memoize" true
}

@memoize
fn double(x) => x * 2

flow "F" {
  @retry(2)
  step "s" { expect true }
}`;

const LIB = `pub deco tagged(target: Flow | Step, label: string) {
  target.meta "tag" label
}

deco hidden(target: Fn) {
  target.meta "hidden" true
}`;

const IMPORTING = `import { tagged } from "./lib.vn"

@tagged("smoke")
flow "F" {
  step "s" { expect true }
}`;

const MODULES = { "lib.vn": LIB };

async function open(at: At): Promise<Fixture & { position: Position }> {
  const built = await fixture(at.source, at.modules);
  const offset = built.document.textDocument.getText().indexOf(at.needle) + (at.into ?? 0);
  return { ...built, position: built.document.textDocument.positionAt(offset) };
}

async function hoverAt(at: At): Promise<string> {
  const { services, document, uri, position } = await open(at);
  const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
    textDocument: { uri },
    position,
  });
  const contents = hover?.contents;
  return contents && typeof contents === "object" && "value" in contents
    ? String(contents.value)
    : "";
}

async function completionsAt(at: At): Promise<CompletionItem[]> {
  const { services, document, uri, position } = await open(at);
  const list = await services.lsp.CompletionProvider?.getCompletion(document, {
    textDocument: { uri },
    position,
  });
  return list?.items ?? [];
}

async function definitionAt(at: At): Promise<{ links: LocationLink[]; text: string }> {
  const { services, document, uri, position } = await open(at);
  const links =
    (await services.lsp.DefinitionProvider?.getDefinition(document, {
      textDocument: { uri },
      position,
    })) ?? [];
  const range = links[0]?.targetRange;
  return { links, text: range ? document.textDocument.getText(range) : "" };
}

async function symbolsOf(source: string): Promise<DocumentSymbol[]> {
  const { services, document, uri } = await fixture(source);
  const symbols = await services.lsp.DocumentSymbolProvider?.getSymbols(document, {
    textDocument: { uri },
  });
  return symbols ?? [];
}

async function renameAt(at: At & { newName: string }): Promise<string> {
  const { services, document, uri, position } = await open(at);
  const edit = await services.lsp.RenameProvider?.rename(document, {
    textDocument: { uri },
    position,
    newName: at.newName,
  });
  return applyEdits(document, edit?.changes?.[uri] ?? []);
}

/**
 * A `deco` is a declaration the language user writes, so the editor owes it
 * what it already owes a `fragment`: a signature, a definition to jump to, a
 * rename that holds, and a line in the outline. The `@name` that applies it is
 * the same thing seen from the other side, and reads the same.
 */
describe("hover on a decorator", () => {
  it("shows the signature and what it decorates, on the declaration", async () => {
    const text = await hoverAt({ source: LOCAL, needle: "memoize(target" });

    expect(text).toContain("deco memoize(target: Fn)");
    expect(text).toContain("Decorates `Fn`.");
    expect(text).toContain("Remembers what it already worked out.");
  });

  it("shows the same on the `@name` that applies it", async () => {
    const text = await hoverAt({ source: LOCAL, needle: "@memoize" });

    expect(text).toContain("deco memoize(target: Fn)");
    expect(text).toContain("Decorates `Fn`.");
  });

  it("names every kind a target allows", async () => {
    const text = await hoverAt({ source: LIB, needle: "tagged(target" });

    expect(text).toContain("pub deco tagged(target: Flow | Step, label: string)");
    expect(text).toContain("Decorates `Flow`, `Step`.");
  });

  it("resolves an imported `@name` back to the file that declares it", async () => {
    const text = await hoverAt({ source: IMPORTING, needle: "@tagged", modules: MODULES });

    expect(text).toContain("pub deco tagged(target: Flow | Step, label: string)");
    expect(text).toContain("lib.vn");
  });

  it("still explains a built-in, in the same shape", async () => {
    const text = await hoverAt({ source: LOCAL, needle: "@retry" });

    expect(text).toContain("Decorates `Flow`, `Step`, `Group`.");
    expect(text).toContain("backoff");
  });

  it("explains the word `deco` itself when the cursor is on the keyword", async () => {
    const text = await hoverAt({ source: LOCAL, needle: "deco memoize" });

    expect(text).toContain("first parameter is the target");
    expect(text).not.toContain("Decorates");
  });
});

describe("completion after `@`", () => {
  it("offers the built-ins with what each one decorates", async () => {
    const items = await completionsAt({ source: LOCAL, needle: "@retry", into: 1 });

    expect(items.find((entry) => entry.label === "retry")?.detail).toBe("Flow, Step, Group");
    // `@scope` went with `resource`: there is no longer a lifetime to declare.
    expect(items.map((entry) => entry.label)).toContain("lock");
  });

  it("offers the `deco`s this file declares", async () => {
    const items = await completionsAt({ source: LOCAL, needle: "@retry", into: 1 });
    const memoize = items.find((entry) => entry.label === "memoize");

    expect(memoize?.detail).toBe("Fn");
    expect(memoize?.documentation).toContain("Remembers what it already worked out.");
  });

  it("offers a `pub deco` it imported, and nothing the other file kept to itself", async () => {
    const items = await completionsAt({
      source: IMPORTING,
      needle: "@tagged",
      into: 1,
      modules: MODULES,
    });

    expect(items.find((entry) => entry.label === "tagged")?.detail).toBe("Flow, Step");
    expect(items.map((entry) => entry.label)).not.toContain("hidden");
  });
});

describe("go to definition on `@name`", () => {
  it("lands on the `deco` that declares it", async () => {
    const { text } = await definitionAt({ source: LOCAL, needle: "@memoize" });

    expect(text).toContain("deco memoize(target: Fn)");
  });

  it("crosses the import to the file that declares it", async () => {
    const { links } = await definitionAt({
      source: IMPORTING,
      needle: "@tagged",
      modules: MODULES,
    });

    expect(links[0]?.targetUri).toContain("lib.vn");
  });

  it("stays put on a built-in, which has no source to land on", async () => {
    const { links } = await definitionAt({ source: LOCAL, needle: "@retry" });

    expect(links).toEqual([]);
  });
});

describe("rename a decorator", () => {
  it("renames the declaration and every `@name` that applies it", async () => {
    const renamed = await renameAt({ source: LOCAL, needle: "memoize(target", newName: "cached" });

    expect(renamed).toContain("deco cached(target: Fn)");
    expect(renamed).toContain("@cached\nfn double");
  });

  it("renames from the `@name` too", async () => {
    const renamed = await renameAt({
      source: LOCAL,
      needle: "@memoize",
      into: 1,
      newName: "cached",
    });

    expect(renamed).toContain("deco cached(target: Fn)");
    expect(renamed).toContain("@cached\nfn double");
  });

  it("refuses a built-in, which no file here declares", async () => {
    const { services, document, uri } = await fixture(LOCAL);
    const range = await services.lsp.RenameProvider?.prepareRename(document, {
      textDocument: { uri },
      position: positionOf(document, "retry(2)"),
    });

    expect(range).toBeUndefined();
  });
});

describe("the outline", () => {
  it("lists a `deco` beside the flows it decorates", async () => {
    const names = (await symbolsOf(LOCAL)).map((symbol) => symbol.name);

    expect(names).toContain("memoize");
    expect(names).toContain("F");
  });
});
