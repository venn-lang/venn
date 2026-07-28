import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { URI } from "langium";
import { describe, expect, it } from "vitest";
import { createImportResolver } from "../workspace/index.js";
import { modulesExporting } from "./exporting-modules.js";

// `fixtures/shared/auth.vn` declares `pub fragment login(user)`, and
// `the fixtures' venn.toml` maps `#shared` to `./shared`.
const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = "../testing/fixtures";
const EXAMPLE = resolve(HERE, FIXTURES, "alias-import.vn");

function search(name: string) {
  return modulesExporting({
    name,
    base: URI.file(EXAMPLE),
    imports: createImportResolver(),
  });
}

describe("modules exporting a name", () => {
  it("finds the file that marks the fragment `pub`", () => {
    const found = search("login");

    expect(found.map((module) => module.file)).toEqual(["shared/auth.vn"]);
  });

  it("prefers the configured `#alias` over a relative path", () => {
    expect(search("login")[0]?.specifier).toBe("#shared/auth.vn");
  });

  it("finds nothing for a name no file exports", () => {
    expect(search("neverExported")).toEqual([]);
  });
});
