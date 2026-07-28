import { describe, expect, it } from "vitest";
import type { CompletionItem, SignatureHelp } from "vscode-languageserver";
import { fixture } from "../testing/lsp-fixture.js";

const HEAD = 'use "@venn/http"\n\nconst quem = "x"\n';

/** Everything at the cursor, marked `▮`, in a document of its own. */
async function at(body: string) {
  const whole = HEAD + body;
  const { services, document, uri } = await fixture(whole.replace("▮", ""));
  const position = document.textDocument.positionAt(whole.indexOf("▮"));
  const list = await services.lsp.CompletionProvider?.getCompletion(document, {
    textDocument: { uri },
    position,
  });
  const signature = await services.lsp.SignatureHelp?.provideSignatureHelp(document, {
    textDocument: { uri },
    position,
  });
  return { items: list?.items ?? [], signature };
}

function active(help: SignatureHelp | undefined): string {
  const signature = help?.signatures[0];
  const span = signature?.parameters?.[help?.activeParameter ?? 0]?.label;
  if (!signature || !Array.isArray(span)) return "";
  return signature.label.slice(span[0], span[1]);
}

function labels(items: CompletionItem[]): string[] {
  return [...items]
    .sort((a, b) => (a.sortText ?? a.label).localeCompare(b.sortText ?? b.label))
    .map((each) => each.label);
}

/**
 * A verb's options are its last argument, a map, and the editor has to say so
 * wherever the call is written.
 *
 * They belong in the signature and in the suggestions. Otherwise a reader at
 * `http.get("u", ▮)` is offered the values in scope, none of which can go
 * there, and the signature reads `http.get(url: string)` as though the call
 * took nothing else.
 */
describe("where a verb's options are due", () => {
  it("names them in the signature, with brackets", async () => {
    const { signature } = await at('const r = http.get("u", ▮)');

    expect(signature?.signatures[0]?.label).toBe("http.get(url: string, { … })");
    expect(active(signature)).toBe("{ … }");
  });

  it("names them without brackets too", async () => {
    const { signature } = await at('const r = http.get "u" ▮');

    expect(active(signature)).toBe("{ … }");
  });

  it("lists the keys as the active parameter's documentation", async () => {
    const { signature } = await at('const r = http.get("u", ▮)');
    const doc = String(signature?.signatures[0]?.parameters?.[1]?.documentation ?? "");

    expect(doc).toContain("headers");
    expect(doc).toContain("body");
  });

  it("offers the map, then its keys, after a comma", async () => {
    const { items } = await at('const r = http.get("u", ▮)');

    expect(labels(items)[0]).toBe("{ … }");
    expect(labels(items)).toContain("headers");
  });

  it("offers the same without brackets", async () => {
    expect(labels((await at('const r = http.get "u" ▮')).items)[0]).toBe("{ … }");
  });

  /** Where a real argument is still due, values in scope are what may go there. */
  it("still offers values where an argument is due", async () => {
    expect(labels((await at("const r = http.get(▮)")).items)[0]).toBe("quem");
  });
});
