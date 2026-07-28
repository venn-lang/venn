import { describe, expect, it } from "vitest";
import type { SignatureHelp } from "vscode-languageserver";
import { fixture } from "../testing/lsp-fixture.js";

const HEAD = `use "venn/assert"
use "venn/fmt"

fn saudacao(nome, idade) => nome
fragment login(user, plan) { step "s" { expect true } }
const op = (a, b) => a + b

const quem = "ada"
const anos = 36
`;

/** Signature help with the cursor where `▮` is, in a document of its own. */
async function helpAt(body: string): Promise<SignatureHelp | undefined> {
  const { services, document, uri } = await fixture(HEAD + body.replace("▮", ""));
  const at = (HEAD + body).indexOf("▮");
  return services.lsp.SignatureHelp?.provideSignatureHelp(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(at),
  });
}

/** The active parameter's own text, cut out of the label. */
function active(help: SignatureHelp | undefined): string {
  const signature = help?.signatures[0];
  const span = signature?.parameters?.[help?.activeParameter ?? 0]?.label;
  if (!signature || !Array.isArray(span)) return "";
  return signature.label.slice(span[0], span[1]);
}

/**
 * A call written with brackets, whoever declared what it calls. The state that
 * most needs explaining, `f("a", ▮)`, is a syntax error while it is being
 * typed, so this is read from the text rather than from the parsed tree.
 */
describe("signature help inside brackets", () => {
  it("names a function this file declares", async () => {
    const help = await helpAt("const t = saudacao(▮)");

    expect(help?.signatures[0]?.label).toBe("saudacao(nome: a, idade: b)");
    expect(active(help)).toBe("nome: a");
  });

  it("moves on past a comma the parser cannot yet accept", async () => {
    expect(active(await helpAt('const t = saudacao("a", ▮)'))).toBe("idade: b");
  });

  /** Two unrelated parameters must not both read as `a`. */
  it("names the type variables apart", async () => {
    expect(await helpAt("const t = saudacao(▮)").then((h) => h?.signatures[0]?.label)).toContain(
      "idade: b",
    );
  });

  it("looks through a `const` holding a lambda", async () => {
    expect((await helpAt("const n = op(1, ▮)"))?.signatures[0]?.label).toBe(
      "op(a: number, b: number)",
    );
  });

  it("answers for the stdlib and the prelude the same way", async () => {
    expect(active(await helpAt("const j = fmt.json(quem, ▮)"))).toBe("indent?: number");
    expect(active(await helpAt("const r = range(1, ▮)"))).toBe("to: number");
  });

  it("takes the innermost call when they nest", async () => {
    expect((await helpAt("const n = op(1, fmt.json(▮))"))?.signatures[0]?.label).toContain(
      "fmt.json",
    );
  });

  it("answers for a fragment behind `run`", async () => {
    const help = await helpAt('flow "f" {\n  run login(▮)\n}');

    expect(help?.signatures[0]?.label).toContain("login(user");
  });

  it("says what a matcher is waiting for", async () => {
    const help = await helpAt('flow "f" {\n  step "s" { expect quem contains ▮ }\n}');

    expect(help?.signatures[0]?.label).toContain("contains value");
  });
});
