import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

const SOURCE = `deco doubled(target: Fn) {
  target.wrap(fn (call, args) => call(args) * 2)
}

@doubled
fn six() => 3
`;

async function hoverAt(needle: string, into = 0): Promise<string> {
  const { services, document, uri } = await fixture(SOURCE);
  const at = SOURCE.indexOf(needle) + into;
  const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(at),
  });
  const contents = hover?.contents;
  return contents && typeof contents === "object" && "value" in contents
    ? String(contents.value)
    : "";
}

/**
 * A `deco` body is written against a handle, and every word of it used to be
 * unexplained: the kind it decorates, the handle itself, and the verbs on it.
 */
describe("hovering inside a decorator", () => {
  it("says what the kind is, and what it offers", async () => {
    const text = await hoverAt("target: Fn", 8);

    expect(text).toContain("decorator target");
    expect(text).toContain("wrap");
    expect(text).toContain("expansion time");
  });

  /**
   * `target.wrap(…)` is a statement, so the parser reads it as an action call
   * whose target is text, so there is no member chain for a hover to walk.
   */
  it("describes the handle where the body uses it", async () => {
    const text = await hoverAt("target.wrap");

    expect(text).toContain("target");
    expect(text).toContain("wrap");
  });

  it("describes the verb being called on it", async () => {
    expect(await hoverAt("target.wrap", 7)).toContain("wrap");
  });

  it("breaks a wide shape across lines instead of running off the edge", async () => {
    const lines = (await hoverAt("target.wrap")).split("\n");

    expect(lines.some((line) => line.trim().startsWith("wrap:"))).toBe(true);
    expect(Math.max(...lines.map((line) => line.length))).toBeLessThan(80);
  });
});
