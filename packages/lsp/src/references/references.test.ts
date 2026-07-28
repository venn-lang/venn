import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

const LIB = `pub fragment entrar(u) { step "s" { expect true } }
pub fn dobro(x: number) -> number => x * 2
pub deco tentar(alvo) { }
`;

/** Every reference to the name at `▮`, as `file:line:character`. */
async function referencesAt(source: string, extra: Record<string, string> = {}): Promise<string[]> {
  const text = source.replace("▮", "");
  const { services, document, uri } = await fixture(text, { "lib.vn": LIB, ...extra });
  const position = document.textDocument.positionAt(source.indexOf("▮"));
  const found = await services.lsp.ReferencesProvider?.findReferences(document, {
    textDocument: { uri },
    position,
    context: { includeDeclaration: true },
  });
  return (found ?? []).map((one) => {
    const where = one.uri.endsWith("lib.vn") ? "lib" : "here";
    return `${where}:${one.range.start.line}:${one.range.start.character}`;
  });
}

/**
 * Shift+F12, on a grammar with no cross-references of its own.
 *
 * Langium's provider answers from the references the grammar declares, and this
 * grammar declares none: a `run` target is a string, a `@name` is a string, and
 * which `const` a name means is worked out by walking scopes. So the answer is
 * worked out the same way the checker works it out.
 */
describe("finding every reference to a name", () => {
  it("finds a local binding, and only the reads that mean it", async () => {
    const source = [
      "const ▮alvo = 1",
      "const outro = alvo + alvo",
      'flow "f" { step "s" {',
      "  const alvo = 2",
      "  expect alvo == 2",
      "} }",
    ].join("\n");

    expect(await referencesAt(source)).toEqual(["here:0:6", "here:1:14", "here:1:21"]);
  });

  it("finds a function across the files that import it", async () => {
    const source = 'import { dobro } from "./lib.vn"\nconst n = ▮dobro(2)\n';

    expect(await referencesAt(source)).toEqual(
      expect.arrayContaining(["here:0:9", "here:1:10", "lib:1:7"]),
    );
  });

  it("finds a fragment: its declaration, its `run`, and the import naming it", async () => {
    const source = 'import { entrar } from "./lib.vn"\nflow "f" { run ▮entrar("a") }\n';

    expect(await referencesAt(source)).toEqual(
      expect.arrayContaining(["here:0:9", "here:1:15", "lib:0:13"]),
    );
  });

  it("finds a decorator on both sides of the @", async () => {
    const source = 'import { tentar } from "./lib.vn"\n@▮tentar\nfn x() => 1\n';

    expect(await referencesAt(source)).toEqual(
      expect.arrayContaining(["here:0:9", "here:1:1", "lib:2:9"]),
    );
  });

  it("finds a type where it is declared and where it is written", async () => {
    const source = "type ▮Preco { id: number }\nconst p: Preco = { id: 1 }\nfn f(x: Preco) => x\n";

    expect(await referencesAt(source)).toEqual(["here:0:5", "here:1:9", "here:2:8"]);
  });

  /** A name spelled the same next door is a different name. */
  it("does not follow a local binding out of its file", async () => {
    const found = await referencesAt("const ▮alvo = 1\n", {
      "outro.vn": "const alvo = 2\nconst x = alvo\n",
    });

    expect(found.every((one) => one.startsWith("here:"))).toBe(true);
  });

  it("can leave the declaration out when the editor asks", async () => {
    const text = "const alvo = 1\nconst outro = alvo\n";
    const { services, document, uri } = await fixture(text);
    const found = await services.lsp.ReferencesProvider?.findReferences(document, {
      textDocument: { uri },
      position: document.textDocument.positionAt(text.indexOf("alvo")),
      context: { includeDeclaration: false },
    });

    expect(found).toHaveLength(1);
    expect(found?.[0]?.range.start.line).toBe(1);
  });
});
