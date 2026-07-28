import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

const SOURCE = `fragment login(user) {
  step "in" { expect true }
}

flow "Checkout" {
  step "Ping" { expect true }
  group "Payment" {
    step "Charge" { expect true }
  }
}`;

describe("document symbols", () => {
  it("outlines flows with their nested steps and groups", async () => {
    const { services, document, uri } = await fixture(SOURCE);

    const symbols = await services.lsp.DocumentSymbolProvider?.getSymbols(document, {
      textDocument: { uri },
    });
    const flow = symbols?.find((symbol) => symbol.name === "Checkout");

    expect(symbols?.map((symbol) => symbol.name)).toContain("login");
    expect(flow?.children?.map((child) => child.name)).toEqual(["Ping", "Payment"]);
    expect(flow?.children?.[1]?.children?.map((child) => child.name)).toEqual(["Charge"]);
  });
});
