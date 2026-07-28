import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fixtureFromFile, positionOf } from "../testing/lsp-fixture.js";

// The fixture: `import { login } from "#shared/auth.vn"`. Anchored to
// this file, not the cwd, so it resolves whether vitest runs here or at the root.
const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = "../testing/fixtures";
const EXAMPLE = resolve(HERE, FIXTURES, "alias-import.vn");

describe("go to definition through a #alias path", () => {
  it("resolves the alias via [paths] in venn.toml", async () => {
    const { services, document, uri } = await fixtureFromFile(EXAMPLE);

    const links = await services.lsp.DefinitionProvider?.getDefinition(document, {
      textDocument: { uri },
      position: positionOf(document, 'login("alice")'),
    });

    expect(links?.[0]?.targetUri).toMatch(/fixtures[/]shared[/]auth\.vn$/);
  });
});
