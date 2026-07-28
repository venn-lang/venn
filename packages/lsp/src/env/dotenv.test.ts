import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { URI } from "langium";
import { describe, expect, it } from "vitest";
import { createImportResolver } from "../workspace/import-resolver.js";

const TOML = `[package]
name = "t"
version = "1"

[env.local]
BASE = "from-toml"
`;

/** A project on disk, since this is exactly what reading from disk does. */
function project(files: Record<string, string>): URI {
  const at = mkdtempSync(join(tmpdir(), "venn-lsp-env-"));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(at, name), body);
  return URI.file(join(at, "main.vn"));
}

describe("what the editor knows about env", () => {
  it("reads the sections venn.toml declares", () => {
    const base = project({ "venn.toml": TOML });

    expect(createImportResolver().env(base).local?.BASE).toBe("from-toml");
  });

  // The editor has to show what a run would see, and a run reads `.env` too.
  it("folds a dotenv file over the declared value", () => {
    const base = project({ "venn.toml": TOML, ".env": "BASE=from-dotenv\nEXTRA=x" });
    const env = createImportResolver().env(base);

    expect(env.local?.BASE).toBe("from-dotenv");
    expect(env.local?.EXTRA).toBe("x");
  });

  it("keeps each environment's own file separate", () => {
    const toml = `${TOML}\n[env.staging]\nBASE = "toml-staging"\n`;
    const base = project({
      "venn.toml": toml,
      ".env.staging": "BASE=dotenv-staging",
      ".env.local": "BASE=dotenv-local",
    });
    const env = createImportResolver().env(base);

    expect(env.staging?.BASE).toBe("dotenv-local");
    expect(env.local?.BASE).toBe("dotenv-local");
  });

  // A project may have no `[env.*]` at all and still want its `.env` offered.
  it("offers what a dotenv file declares with no section for it", () => {
    const base = project({
      "venn.toml": '[package]\nname = "t"\nversion = "1"\n',
      ".env": "ONLY_IN_FILE=1",
    });

    expect(createImportResolver().env(base).local?.ONLY_IN_FILE).toBe("1");
  });
});
