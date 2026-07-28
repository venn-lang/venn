import { describe, expect, it } from "vitest";
import { fixture, positionOf } from "../testing/lsp-fixture.js";

const SOURCE = `deco retry(target: Flow, times: number) {
  target.meta "retry" times
}

@retry(2)
flow "Checkout" { }
`;

async function hoverAt(needle: string): Promise<string> {
  const { services, document, uri } = await fixture(SOURCE);
  const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
    textDocument: { uri },
    position: positionOf(document, needle),
  });
  const contents = hover?.contents;
  return contents && typeof contents === "object" && "value" in contents
    ? String(contents.value)
    : "";
}

/**
 * A `deco` is a declaration like `fn`, so its parameters answer a hover like
 * any other. The first one says what the decorator decorates, and the type on
 * it is the handle the body actually holds.
 */
describe("hovering a deco's parameters", () => {
  it("shows the target's kind as the surface it offers", async () => {
    const text = await hoverAt("target: Flow");

    expect(text).toContain("title: string");
    expect(text).toContain("What this decorator decorates");
  });

  it("shows an ordinary argument as the decorator's own", async () => {
    const text = await hoverAt("times: number");

    expect(text).toContain("times: number");
    expect(text).toContain("Argument of this decorator");
  });
});
