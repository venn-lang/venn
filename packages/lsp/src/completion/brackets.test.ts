import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

const HEAD = `use "venn/assert"
use "venn/fmt"

fn saudacao(nome, idade) => nome
const quem = "ada"
const anos = 36
`;

/** The labels in the order the editor will show them, cursor at `▮`. */
async function ranked(body: string): Promise<string[]> {
  const { services, document, uri } = await fixture(HEAD + body.replace("▮", ""));
  const at = (HEAD + body).indexOf("▮");
  const list = await services.lsp.CompletionProvider?.getCompletion(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(at),
  });
  return [...(list?.items ?? [])]
    .sort((a, b) => (a.sortText ?? a.label).localeCompare(b.sortText ?? b.label))
    .map((each) => each.label);
}

/**
 * The same rule as an argument written without brackets: what the program
 * already holds comes first, and namespaces come after.
 */
describe("completion inside brackets", () => {
  it("offers what is in scope, not the list of namespaces", async () => {
    const labels = await ranked("const t = saudacao(▮)");

    expect(labels.slice(0, 3)).toContain("quem");
    expect(labels.indexOf("http")).toBeGreaterThan(1);
  });

  it("puts the fitting type first", async () => {
    expect((await ranked("const j = fmt.json(quem, ▮)"))[0]).toBe("anos");
  });

  /** Nothing holds `t` yet, so accepting it would define it in terms of itself. */
  it("does not offer the binding being written", async () => {
    expect(await ranked("const t = saudacao(▮)")).not.toContain("t");
  });

  it("answers after a matcher word too", async () => {
    const labels = await ranked('flow "f" {\n  step "s" { expect quem contains ▮ }\n}');

    expect(labels).toContain("quem");
    expect(labels.indexOf("http")).toBeGreaterThan(0);
  });
});
