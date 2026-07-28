import { describe, expect, it } from "vitest";
import type { SignatureHelp } from "vscode-languageserver";
import { fixture } from "../testing/lsp-fixture.js";

// `·` is the space that has just been typed, written so an editor cannot trim
// it away. The trailing space is the whole subject of these tests.
const SOURCE = `use "venn/http"

const api = http.serve { port: 8099 }
http.on·
http.on api·
http.get·
print·
wait·
const plain = 1·
`.replaceAll("·", " ");

/** Signature help with the cursor at the end of `line`, as if just typed. */
async function helpAfter(line: string): Promise<SignatureHelp | undefined> {
  const { services, document, uri } = await fixture(SOURCE);
  const at = SOURCE.indexOf(`${line}\n`) + line.length;
  return services.lsp.SignatureHelp?.provideSignatureHelp(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(at),
  });
}

/** The active parameter's own text, cut out of the signature label. */
function activeText(help: SignatureHelp | undefined): string {
  const signature = help?.signatures[0];
  const parameter = signature?.parameters?.[help?.activeParameter ?? 0];
  const span = parameter?.label;
  if (!signature || !Array.isArray(span)) return "";
  return signature.label.slice(span[0], span[1]);
}

/**
 * A Venn call has no brackets to hang a hint off: `http.on ` is already a call
 * with an argument due. So the space is what asks, and what comes back has to
 * name the argument, not merely count it.
 */
describe("signature help for a verb being typed", () => {
  it("names the argument due, and says what it is for", async () => {
    const help = await helpAfter("http.on ");

    expect(help?.signatures[0]?.label).toContain("http.on server");
    expect(activeText(help)).toBe("server: http.Server");
    expect(String(help?.signatures[0]?.parameters?.[0]?.documentation)).toContain("http.serve");
  });

  it("moves to the next argument as the space is pressed", async () => {
    expect(activeText(await helpAfter("http.on api "))).toContain("handler");
  });

  it("answers for the prelude too", async () => {
    expect(activeText(await helpAfter("print "))).toContain("values");
    expect(activeText(await helpAfter("wait "))).toBe("duration: duration");
  });

  it("shows the options map when the verb takes one", async () => {
    expect((await helpAfter("http.get "))?.signatures[0]?.label).toContain("{ … }");
  });

  it("stays quiet where no call is being written", async () => {
    expect(await helpAfter("const plain = 1 ")).toBeUndefined();
  });
});
