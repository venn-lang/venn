import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fixtureFromFile, positionOf } from "../testing/lsp-fixture.js";

// the alias-import fixture imports `login` from `#shared/auth.vn`, which
// documents it with a `##` block.
const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = "../testing/fixtures";
const EXAMPLE = resolve(HERE, FIXTURES, "alias-import.vn");

async function hoverAt(needle: string): Promise<string> {
  const { services, document, uri } = await fixtureFromFile(EXAMPLE);
  const hover = await services.lsp.HoverProvider?.getHoverContent(document, {
    textDocument: { uri },
    position: positionOf(document, needle),
  });
  const contents = hover?.contents;
  return contents && typeof contents === "object" && "value" in contents
    ? String(contents.value)
    : "";
}

describe("hover across an import", () => {
  it("reads the documentation of a fragment declared in another file", async () => {
    const text = await hoverAt('login("alice")');

    expect(text).toContain("pub fragment login(user)");
    expect(text).toContain("Signs a user in through the API");
    expect(text).toContain("**Parameters**");
    expect(text).toContain("The account name to sign in as");
    expect(text).toContain("**Returns**");
    expect(text).toContain("**Example**");
    expect(text).toContain("auth.vn");
  });
});
