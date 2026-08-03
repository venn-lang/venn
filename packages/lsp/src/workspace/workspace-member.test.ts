import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { URI } from "langium";
import { describe, expect, it } from "vitest";
import { createImportResolver } from "./import-resolver.js";

const NEWLINE = String.fromCharCode(10);
const lines = (...parts: readonly string[]): string => parts.join(NEWLINE);

const ROOT = lines(
  "[workspace]",
  'members = ["apps/*", "shared"]',
  "",
  "[env.local]",
  'ROOT_VAR = "from-root"',
  "",
  "[paths]",
  '"#shared" = "./shared"',
);

const MEMBER = lines("[package]", 'name = "web"', 'version = "1.0.0"');

/** A workspace on disk, since reading one is exactly what this does. */
function workspace(files: Record<string, string>): string {
  const at = mkdtempSync(join(tmpdir(), "venn-lsp-workspace-"));
  for (const [name, body] of Object.entries(files)) {
    const path = join(at, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
  }
  return at;
}

const built = (): string =>
  workspace({
    "venn.toml": ROOT,
    "apps/web/venn.toml": MEMBER,
    "apps/web/main.vn": "print 1",
    "shared/helpers.vn": "pub fn greet(who) => who",
  });

/**
 * A member reads what its root declared.
 *
 * The editor took the first `venn.toml` it found and used it verbatim, so
 * `[workspace]` went unread: every root-declared `env.*` was a red squiggle on
 * code that checks and runs clean, and every `#alias` resolved to a path
 * nothing is indexed at, which is go-to-definition finding nothing and
 * completion offering nothing.
 */
describe("a file inside a workspace member", () => {
  it("sees the variables the root declared", () => {
    const at = built();
    const env = createImportResolver().env(URI.file(join(at, "apps", "web", "main.vn")));

    expect(env.local?.ROOT_VAR).toBe("from-root");
  });

  it("resolves an alias the root declared, from where the member reads it", () => {
    const at = built();
    const from = URI.file(join(at, "apps", "web", "main.vn"));
    const found = createImportResolver().resolve("#shared/helpers.vn", from);

    // Lowercased: vscode-uri normalises a Windows drive letter, and the path is
    // what is being asserted rather than how the drive is spelt.
    expect(found.fsPath.toLowerCase()).toBe(join(at, "shared", "helpers.vn").toLowerCase());
  });

  /** A project that is nobody's member is still read the way it was written. */
  it("is untouched when no workspace above claims it", () => {
    const at = workspace({
      "venn.toml": lines("[workspace]", 'members = ["packages/*"]', "[env.local]", 'A = "1"'),
      "apps/web/venn.toml": MEMBER,
      "apps/web/main.vn": "print 1",
    });
    const env = createImportResolver().env(URI.file(join(at, "apps", "web", "main.vn")));

    expect(env.local?.A).toBeUndefined();
  });
});
