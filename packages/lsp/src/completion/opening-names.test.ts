import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

const LIB = `pub fn triplo(x: number) -> number => x * 3
fn privado(x: number) -> number => x
`;

/** What the editor offers at `▮`. */
async function offeredAt(whole: string): Promise<string[]> {
  const { services, document, uri } = await fixture(whole.replace("▮", ""), { "lib.vn": LIB });
  const list = await services.lsp.CompletionProvider?.getCompletion(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(whole.indexOf("▮")),
  });
  return (list?.items ?? []).map((each) => each.label);
}

/**
 * What a fresh statement offers.
 *
 * Calling a function is a statement, so the bound names belong here: a `fn`, a
 * `const`, a helper imported from the file next door. The language's own words
 * are still offered; they simply come after.
 */
describe("starting a statement", () => {
  it("offers a function this file declared", async () => {
    expect(await offeredAt("fn local(x) => x\n▮\n")).toContain("local");
  });

  it("offers a value this file bound", async () => {
    expect(await offeredAt("const valor = 1\n▮\n")).toContain("valor");
  });

  it("offers a name imported from another file", async () => {
    expect(await offeredAt('import { triplo } from "./lib.vn"\n▮\n')).toContain("triplo");
  });

  /** Never a name the other file kept to itself. */
  it("does not offer what the other file kept private", async () => {
    expect(await offeredAt('import { triplo } from "./lib.vn"\n▮\n')).not.toContain("privado");
  });

  it("offers them inside a step as well", async () => {
    const source = 'use "venn/assert"\nfn local(x) => x\nflow "f" { step "s" { ▮ } }\n';

    expect(await offeredAt(source)).toContain("local");
  });

  it("still offers the words that open a statement", async () => {
    const offered = await offeredAt("fn local(x) => x\n▮\n");

    expect(offered).toContain("expect");
    expect(offered).toContain("step");
  });
});
