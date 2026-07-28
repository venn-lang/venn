import { createMemoryFs, defaultManifest, type FileSystem } from "@venn/contracts";
import { describe, expect, it } from "vitest";
import { writeLockfile } from "./lockfile.js";
import { isSafeSpec, managerCommand } from "./manager-command.js";
import { packageJsonFor } from "./package-json.js";
import { readInstalled } from "./read-installed.js";

function dep(name: string, version?: string, path?: string) {
  return { name, version, path, fromWorkspace: false, optional: false };
}

/**
 * The `package.json` a package manager is shown.
 *
 * Nobody edits it and nobody commits it: `venn.toml` is the source and this is
 * what the tool underneath happens to read. It is written *into* `target/`, and
 * that placement is the trick the whole design rests on: a manager writes
 * `node_modules` beside the file it was pointed at.
 */
describe("what the package manager is shown", () => {
  it("carries the versions asked for, in name order", () => {
    const manifest = defaultManifest({
      name: "loja",
      dependencies: [dep("zod", "^4"), dep("hono", "^4.1")],
    });

    const json = JSON.parse(packageJsonFor({ manifest }));

    expect(Object.keys(json.dependencies)).toEqual(["hono", "zod"]);
    expect(json.dependencies.zod).toBe("^4");
  });

  /** A path dependency is another package in this workspace, not a download. */
  it("leaves a dependency on a path out of it", () => {
    const manifest = defaultManifest({ dependencies: [dep("shared", undefined, "../shared")] });

    expect(JSON.parse(packageJsonFor({ manifest })).dependencies).toEqual({});
  });

  it("gathers every member's dependencies into the one file", () => {
    const root = defaultManifest({ name: "raiz", dependencies: [dep("zod", "^4")] });
    const member = defaultManifest({ name: "api", dependencies: [dep("hono", "^4")] });

    const json = JSON.parse(packageJsonFor({ manifest: root, members: [member] }));

    expect(Object.keys(json.dependencies)).toEqual(["hono", "zod"]);
  });

  it("turns [patch] into an override", () => {
    const manifest = defaultManifest({ patch: [dep("zod", "4.0.1")] });

    expect(JSON.parse(packageJsonFor({ manifest })).overrides).toEqual({ zod: "4.0.1" });
  });

  it("is marked private, so nothing can publish it by accident", () => {
    expect(JSON.parse(packageJsonFor({ manifest: defaultManifest() })).private).toBe(true);
  });
});

describe("the command each verb becomes", () => {
  it("uses each manager's own spelling", () => {
    const forEach = (manager: "pnpm" | "npm") =>
      managerCommand({ manager, verb: "remove", packages: ["zod"], platform: "linux" });

    expect(forEach("pnpm").args).toEqual(["remove", "zod"]);
    expect(forEach("npm").args).toEqual(["uninstall", "zod"]);
  });

  it("marks a development dependency the one way they all understand", () => {
    const found = managerCommand({
      manager: "bun",
      verb: "add",
      packages: ["faker"],
      dev: true,
      platform: "linux",
    });

    expect(found.args).toEqual(["add", "-D", "faker"]);
  });

  /** Node refuses to spawn a `.cmd` directly, and these all ship as scripts. */
  it("asks for a shell only where one is needed", () => {
    const on = (platform: string) =>
      managerCommand({ manager: "pnpm", verb: "install", platform }).shell;

    expect(on("win32")).toBe(true);
    expect(on("linux")).toBe(false);
  });
});

/**
 * What may be handed to a shell.
 *
 * The command goes through one on Windows, where `&` and `|` are instructions
 * rather than text, so this is what stands between `venn add` and a command
 * that deletes a directory while looking like an install.
 */
describe("whether a specifier is a package name", () => {
  it("accepts the shapes npm allows", () => {
    for (const spec of ["zod", "@types/node", "zod@^4", "a-b.c_d", "@scope/pkg@1.2.3-beta.1"]) {
      expect(isSafeSpec(spec)).toBe(true);
    }
  });

  it("refuses anything a shell would read as an instruction", () => {
    for (const spec of ["x & del", "a | b", "a > b", "a; b", "$(x)", "`x`", "a b", "../../etc"]) {
      expect(isSafeSpec(spec)).toBe(false);
    }
  });
});

async function withModules(files: Record<string, string>): Promise<FileSystem> {
  const fs = createMemoryFs();
  const encoder = new TextEncoder();
  for (const [path, text] of Object.entries(files)) await fs.write(path, encoder.encode(text));
  return fs;
}

const INSTALLED = {
  "repo/target/node_modules/zod/package.json": '{"name":"zod","version":"4.4.3"}',
  "repo/target/node_modules/@types/node/package.json": '{"name":"@types/node","version":"24.1.0"}',
  "repo/target/node_modules/.pnpm/lock.yaml": "irrelevante",
  "repo/target/node_modules/quebrado/package.json": "{ isso não é json",
};

describe("what the lock records", () => {
  it("reads every package installed, scoped ones included", async () => {
    const fs = await withModules(INSTALLED);

    const found = await readInstalled({ fs, root: "repo" });

    expect(found.map((one) => one.name)).toEqual(["@types/node", "zod"]);
  });

  /** A directory that is not a package is not a package. */
  it("skips the manager's own bookkeeping and anything unreadable", async () => {
    const fs = await withModules(INSTALLED);

    const found = await readInstalled({ fs, root: "repo" });

    expect(found.map((one) => one.name)).not.toContain("quebrado");
  });

  it("writes the lock at the project root, naming the manager", async () => {
    const fs = await withModules(INSTALLED);

    const lock = await writeLockfile({ fs, root: "repo", manager: "pnpm" });
    const text = new TextDecoder().decode(await fs.read("repo/venn.lock"));

    expect(lock.manager).toBe("pnpm");
    expect(JSON.parse(text).packages).toHaveLength(2);
  });
});
