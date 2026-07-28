import { describe, expect, it } from "vitest";
import { scaffold } from "./scaffold.js";

function pathsOf(files: readonly { path: string }[]): string[] {
  return files.map((file) => file.path);
}

function contentAt(files: readonly { path: string; content: string }[], path: string): string {
  return files.find((file) => file.path === path)?.content ?? "";
}

describe("what a new project starts as", () => {
  it("gives a program a main and a library a lib", () => {
    expect(pathsOf(scaffold({ kind: "bin", name: "api" }))).toContain("src/main.vn");
    expect(pathsOf(scaffold({ kind: "lib", name: "core" }))).toContain("src/lib.vn");
  });

  it("gives a workspace a root and no source of its own", () => {
    const files = scaffold({ kind: "workspace", name: "acme" });

    expect(pathsOf(files)).toEqual(["venn.toml", ".gitignore"]);
    expect(contentAt(files, "venn.toml")).toContain("[workspace]");
  });

  it("ignores the one directory everything derived lives in", () => {
    expect(contentAt(scaffold({ kind: "bin", name: "api" }), ".gitignore")).toBe("target/\n");
  });
});

/**
 * A member is written differently, not just elsewhere.
 *
 * Repeating the version would shadow the one the root supplies, which is the
 * whole reason `[workspace.package]` exists; and carrying its own ignore file
 * would be ignoring a `target/` it has not got.
 */
describe("a package started inside a workspace", () => {
  it("leaves out what it inherits", () => {
    const files = scaffold({ kind: "bin", name: "api", insideWorkspace: true });

    expect(contentAt(files, "venn.toml")).not.toContain("version");
    expect(contentAt(files, "venn.toml")).toContain('name = "api"');
  });

  it("does not carry its own ignore file", () => {
    const files = scaffold({ kind: "bin", name: "api", insideWorkspace: true });

    expect(pathsOf(files)).toEqual(["venn.toml", "src/main.vn"]);
  });

  /** Outside one, it stands alone and says so. */
  it("writes both when it stands alone", () => {
    const files = scaffold({ kind: "bin", name: "api" });

    expect(contentAt(files, "venn.toml")).toContain('version = "0.1.0"');
    expect(pathsOf(files)).toContain(".gitignore");
  });
});
