import { createMemoryFs, type FileSystem } from "@venn-lang/contracts";
import { describe, expect, it } from "vitest";
import { findProject } from "../discover/index.js";
import { reanchor } from "../paths/index.js";

async function diskOf(files: Record<string, string>): Promise<FileSystem> {
  const fs = createMemoryFs();
  const encoder = new TextEncoder();
  for (const [path, content] of Object.entries(files))
    await fs.write(path, encoder.encode(content));
  return fs;
}

const DISK = {
  "repo/venn.toml": `[workspace]
members = ["packages/*"]

[paths]
"#compartilhado" = "./compartilhado"

[env.local]
BASE = "http://raiz"
TOKEN = "da-raiz"`,
  "repo/compartilhado/util.vn": "pub fn x() => 1",
  "repo/packages/api/venn.toml": `[package]
name = "api"

[paths]
"#proprio" = "./interno"

[env.local]
TOKEN = "do-membro"`,
  "repo/packages/api/src/main.vn": "print 1",
};

/**
 * What a member reads that its root wrote.
 *
 * A workspace almost always wants one `[env.staging]` and one `#shared`. The
 * alternative, every member repeating every variable, drifts silently until two
 * members disagree about a URL.
 */
describe("settings a member takes from its root", () => {
  it("sees the root's environments, and wins per key where it wrote one", async () => {
    const fs = await diskOf(DISK);

    const project = (await findProject({ fs, from: "repo/packages/api" })).project;
    const env = project?.packages.find((one) => one.manifest.name === "api")?.manifest.env;

    expect(env?.local?.BASE).toBe("http://raiz");
    expect(env?.local?.TOKEN).toBe("do-membro");
  });

  /**
   * The alias was written at the root, and is read two directories down. Left
   * alone it pointed at `packages/api/compartilhado`, which is nowhere.
   */
  it("rewrites an inherited alias to mean the same place from down here", async () => {
    const fs = await diskOf(DISK);

    const project = (await findProject({ fs, from: "repo/packages/api" })).project;
    const paths = project?.packages.find((one) => one.manifest.name === "api")?.manifest.paths;

    expect(paths?.["#compartilhado"]).toBe("../../compartilhado");
  });

  it("leaves an alias the member wrote itself exactly as written", async () => {
    const fs = await diskOf(DISK);

    const project = (await findProject({ fs, from: "repo/packages/api" })).project;
    const paths = project?.packages.find((one) => one.manifest.name === "api")?.manifest.paths;

    expect(paths?.["#proprio"]).toBe("./interno");
  });
});

describe("rewriting a relative path for a directory below", () => {
  it("climbs one level per directory of depth", () => {
    expect(reanchor({ path: "./shared", declaredIn: "/r", usedIn: "/r/a" })).toBe("../shared");
    expect(reanchor({ path: "./shared", declaredIn: "/r", usedIn: "/r/a/b" })).toBe("../../shared");
  });

  it("leaves it alone when it is read where it was written", () => {
    expect(reanchor({ path: "./shared", declaredIn: "/r", usedIn: "/r" })).toBe("./shared");
  });

  /** Only a relative path means something different from somewhere else. */
  it("leaves an absolute path alone", () => {
    expect(reanchor({ path: "/abs/shared", declaredIn: "/r", usedIn: "/r/a" })).toBe("/abs/shared");
  });
});
