import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fixtureFromFile, positionOf } from "../testing/lsp-fixture.js";

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

/**
 * The names inside `import { … }`.
 *
 * A name in the import list is the first place a reader meets it, and the one
 * place they are deciding whether they want it at all, so a hover is worth the
 * most there. It is also the one spot where a name is neither a declaration nor
 * a use, so no other branch of the hover reaches it.
 */
describe("hover on a name in the import list", () => {
  it("describes an imported fragment", async () => {
    const text = await hoverAt("login }");

    expect(text).toContain("pub fragment login(user)");
    expect(text).toContain("Signs a user in through the API");
    expect(text).toContain("auth.vn");
  });

  it("describes an imported function, with its signature and docs", async () => {
    const text = await hoverAt("authHeader, login");

    expect(text).toContain("pub fn authHeader(token: string) -> string");
    expect(text).toContain("**Parameters**");
    expect(text).toContain("The session token to send");
  });

  it("still says what the specifier resolves to", async () => {
    const text = await hoverAt('"#shared/auth.vn"');

    expect(text).toContain("auth.vn");
  });
});
