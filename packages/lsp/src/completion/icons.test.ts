import { describe, expect, it } from "vitest";
import { CompletionItemKind } from "vscode-languageserver";
import { fixture } from "../testing/lsp-fixture.js";

const HEAD = `use "venn/http"

type Preco { id: number }

const fixo = "a"
let variavel = "b"
fn rotear(req) => req
fragment entrar(user) { step "s" { expect true } }
const api = http.serve { port: 0 }
`;

/** What the editor offers at `▮`, as label → icon. */
async function iconsAt(whole: string): Promise<Map<string, CompletionItemKind | undefined>> {
  const { services, document, uri } = await fixture(whole.replace("▮", ""));
  const list = await services.lsp.CompletionProvider?.getCompletion(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(whole.indexOf("▮")),
  });
  return new Map((list?.items ?? []).map((each) => [each.label, each.kind]));
}

/**
 * One icon per kind of thing.
 *
 * A `const`, a `let`, a parameter and a `fn` drawn alike tell the reader
 * nothing about what they are accepting, and one published type must not be an
 * `Interface` in one list and a `Struct` in another.
 */
describe("the icon each suggestion carries", () => {
  it("tells a const from a let from a fn", async () => {
    const icons = await iconsAt(`${HEAD}http.on api ▮\n`);

    expect(icons.get("fixo")).toBe(CompletionItemKind.Constant);
    expect(icons.get("variavel")).toBe(CompletionItemKind.Variable);
    expect(icons.get("rotear")).toBe(CompletionItemKind.Function);
  });

  /**
   * A fragment is not a function drawn the same way.
   *
   * One gives back a value; the other gives back steps that the report records
   * and that can fail. Putting one where the other belongs is a mistake the
   * checker names outright, and the icon says so first.
   */
  it("draws a fragment apart from a function", async () => {
    const icons = await iconsAt(`${HEAD}http.on api ▮\n`);

    expect(icons.get("entrar")).toBe(CompletionItemKind.Snippet);
    expect(icons.get("entrar")).not.toBe(icons.get("rotear"));
  });

  /** A `fn` is a value: passing one by name is how `http.on(api, route)` reads. */
  it("offers a function the file declared", async () => {
    expect(await iconsAt(`${HEAD}http.on api ▮\n`).then((i) => i.has("rotear"))).toBe(true);
  });

  it("draws a namespace, a verb and a type each their own", async () => {
    const args = await iconsAt(`${HEAD}http.on api ▮\n`);
    expect(args.get("http")).toBe(CompletionItemKind.Module);

    const verbs = await iconsAt(`${HEAD}http.▮\n`);
    expect(verbs.get("get")).toBe(CompletionItemKind.Function);

    const types = await iconsAt(`${HEAD}type Outro { campo: ▮ }\n`);
    expect(types.get("string")).toBe(CompletionItemKind.Keyword);
    expect(types.get("Preco")).toBe(CompletionItemKind.Struct);
    expect(types.get("http.Response")).toBe(CompletionItemKind.Struct);
  });

  it("draws a decorator as something applied, not read", async () => {
    const icons = await iconsAt(`${HEAD}@▮\nfn x() => 1\n`);

    expect(icons.get("retry")).toBe(CompletionItemKind.Function);
  });
});
