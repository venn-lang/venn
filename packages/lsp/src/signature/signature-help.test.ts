import { describe, expect, it } from "vitest";
import { fixture, positionOf } from "../testing/lsp-fixture.js";

const SOURCE = `fragment login(user, plan) {
  step "in" { expect true }
}

flow "F" {
  run login("alice", "pro")
}`;

async function signatureAt(needle: string) {
  const { services, document, uri } = await fixture(SOURCE);
  return services.lsp.SignatureHelp?.provideSignatureHelp(document, {
    textDocument: { uri },
    position: positionOf(document, needle),
  });
}

describe("signature help", () => {
  // Typed as well as named: a fragment is resolved the same way every other
  // bracketed call is, so it says as much as any of them.
  it("shows the fragment's parameter list inside the call", async () => {
    const help = await signatureAt('"alice"');

    expect(help?.signatures[0]?.label).toBe("login(user: dynamic, plan: dynamic)");
    expect(help?.activeParameter).toBe(0);
  });

  it("advances the active parameter past a comma", async () => {
    expect((await signatureAt('"pro"'))?.activeParameter).toBe(1);
  });
});
