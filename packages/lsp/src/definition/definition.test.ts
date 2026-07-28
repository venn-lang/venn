import { describe, expect, it } from "vitest";
import { fixture, positionOf } from "../testing/lsp-fixture.js";

const SOURCE = `use "venn/assert"

fragment login(user) {
  step "in" { expect true }
}

flow "Checkout" {
  step "Ping" {
    let plan = "pro"
    expect plan
    run login("alice")
  }
}`;

async function targetText(needle: string): Promise<string> {
  const { services, document, uri } = await fixture(SOURCE);
  const links = await services.lsp.DefinitionProvider?.getDefinition(document, {
    textDocument: { uri },
    position: positionOf(document, needle),
  });
  const range = links?.[0]?.targetRange;
  return range ? document.textDocument.getText(range) : "";
}

describe("go to definition", () => {
  it("jumps from `run` to the fragment it names", async () => {
    expect(await targetText('login("alice")')).toContain("fragment login(user)");
  });

  it("jumps from a variable to the statement that binds it", async () => {
    expect(await targetText("plan\n")).toBe('let plan = "pro"');
  });
});
