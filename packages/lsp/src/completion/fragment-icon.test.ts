import { describe, expect, it } from "vitest";
import { CompletionItemKind } from "vscode-languageserver";
import { fixture } from "../testing/lsp-fixture.js";

const LIB = `pub fragment entrar(u) { step "s" { expect true } }
pub fn calcular(x: number) -> number => x * 2
`;

/** What the editor offers at `▮`, as label → icon. */
async function iconsAt(whole: string): Promise<Map<string, CompletionItemKind | undefined>> {
  const { services, document, uri } = await fixture(whole.replace("▮", ""), { "lib.vn": LIB });
  const list = await services.lsp.CompletionProvider?.getCompletion(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(whole.indexOf("▮")),
  });
  return new Map((list?.items ?? []).map((each) => [each.label, each.kind]));
}

const IMPORT = 'import { calcular, entrar } from "./lib.vn"\n';

/**
 * A fragment, wherever the editor draws one.
 *
 * It carried the same icon as a function everywhere it appeared, which is the
 * one thing it must not do: a function gives back a value and a fragment gives
 * back steps, and putting either where the other belongs is a mistake the
 * checker now names outright. The icon has to say so first, while the reader is
 * still choosing from a list.
 */
describe("the icon a fragment carries", () => {
  it("is its own inside an import list", async () => {
    const icons = await iconsAt('import { ▮ } from "./lib.vn"\n');

    expect(icons.get("entrar")).toBe(CompletionItemKind.Snippet);
    expect(icons.get("calcular")).toBe(CompletionItemKind.Function);
  });

  it("is its own after `run`", async () => {
    const icons = await iconsAt(`${IMPORT}flow "f" { run ▮ }\n`);

    expect(icons.get("entrar")).toBe(CompletionItemKind.Snippet);
  });

  /** `run` invokes fragments; a function offered there could not be invoked. */
  it("keeps functions out of `run` altogether", async () => {
    const icons = await iconsAt(`${IMPORT}flow "f" { run ▮ }\n`);

    expect(icons.has("calcular")).toBe(false);
  });

  it("is its own where a local fragment is offered as a value", async () => {
    const source = 'fragment local(u) { step "s" { expect true } }\nfn f(x) => x\n▮\n';
    const icons = await iconsAt(source);

    expect(icons.get("local")).toBe(CompletionItemKind.Snippet);
    expect(icons.get("f")).toBe(CompletionItemKind.Function);
  });

  /** An imported name is drawn as whatever the file it came from declared. */
  it("is its own for a name imported from another file", async () => {
    const icons = await iconsAt(`${IMPORT}▮\n`);

    expect(icons.get("entrar")).toBe(CompletionItemKind.Snippet);
    expect(icons.get("calcular")).toBe(CompletionItemKind.Function);
  });
});
