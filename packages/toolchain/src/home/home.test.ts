import { createMemoryFs, type FileSystem } from "@venn-lang/contracts";
import { describe, expect, it } from "vitest";
import { entryOf } from "./entry-of.js";
import { planFor } from "./plan-for.js";
import { defaultVersion, installedVersions, vennHome, versionRoot } from "./venn-home.js";

const HOME = "/home/v/.venn";

/** What a version separated from the orchestrator declares. */
const BIN: Record<string, string> = {
  "venn-run": "./dist/bin/venn-run.mjs",
  "venn-lsp": "./dist/bin/venn-lsp.mjs",
};

/**
 * A version is installed once it declares an entry point and that file is
 * there, which is what `installedVersions` looks for.
 */
async function withVersions(versions: readonly string[]): Promise<FileSystem> {
  const fs = createMemoryFs();
  for (const version of versions) await addVersion(fs, version);
  return fs;
}

async function addVersion(fs: FileSystem, version: string, bin = BIN): Promise<void> {
  const root = versionRoot({ home: HOME, version });
  await write(fs, `${root}/package.json`, JSON.stringify({ name: "@venn-lang/venn", bin }));
  for (const path of Object.values(bin)) {
    await write(fs, `${root}/${path.replace("./", "")}`, "#!/usr/bin/env node\n");
  }
}

async function write(fs: FileSystem, path: string, content: string): Promise<void> {
  await fs.write(path, new TextEncoder().encode(content));
}

describe("where the versions live", () => {
  it("is under the home directory by default", () => {
    expect(vennHome({ env: {}, home: "/home/v" })).toBe("/home/v/.venn");
  });

  /** A machine that keeps tools elsewhere should not have to move a home. */
  it("is wherever VENN_HOME says", () => {
    expect(vennHome({ env: { VENN_HOME: "/opt/venn" }, home: "/home/v" })).toBe("/opt/venn");
  });

  it("ignores a VENN_HOME that says nothing", () => {
    expect(vennHome({ env: { VENN_HOME: "   " }, home: "/home/v" })).toBe("/home/v/.venn");
  });
});

describe("finding what to run", () => {
  it("reads the entry point from what the version declares", async () => {
    const fs = await withVersions(["0.2.0"]);

    expect(await entryOf({ fs, home: HOME, version: "0.2.0", kind: "run" })).toBe(
      "/home/v/.venn/versions/0.2.0/dist/bin/venn-run.mjs",
    );
    expect(await entryOf({ fs, home: HOME, version: "0.2.0", kind: "lsp" })).toBe(
      "/home/v/.venn/versions/0.2.0/dist/bin/venn-lsp.mjs",
    );
  });

  /**
   * The published package still declares `venn`, and the language separated
   * from the orchestrator declares `venn-run`. Both have to work: the older one
   * is already on people's machines.
   */
  it("accepts the name the older published package uses", async () => {
    const fs = createMemoryFs();
    await addVersion(fs, "0.1.3", { venn: "./dist/bin/venn.mjs" });

    expect(await entryOf({ fs, home: HOME, version: "0.1.3", kind: "run" })).toBe(
      "/home/v/.venn/versions/0.1.3/dist/bin/venn.mjs",
    );
  });

  it("has nothing for a version that is not there", async () => {
    const fs = createMemoryFs();

    expect(await entryOf({ fs, home: HOME, version: "9.9.9", kind: "run" })).toBeUndefined();
  });

  it("has nothing when the version declares no entry of that kind", async () => {
    const fs = createMemoryFs();
    await addVersion(fs, "0.1.3", { venn: "./dist/bin/venn.mjs" });

    expect(await entryOf({ fs, home: HOME, version: "0.1.3", kind: "lsp" })).toBeUndefined();
  });

  it("reads a manifest that cannot be parsed as offering nothing", async () => {
    const fs = createMemoryFs();
    await write(fs, `${versionRoot({ home: HOME, version: "0.1.3" })}/package.json`, "{ broken");

    expect(await entryOf({ fs, home: HOME, version: "0.1.3", kind: "run" })).toBeUndefined();
  });
});

describe("which versions are installed", () => {
  it("reads them from the directory", async () => {
    const fs = await withVersions(["0.1.3", "0.2.0"]);

    expect((await installedVersions({ fs, home: HOME })).sort()).toEqual(["0.1.3", "0.2.0"]);
  });

  /** A version that cannot be run is not installed, however complete it looks. */
  it("does not count a directory with no entry point", async () => {
    const fs = await withVersions(["0.1.3"]);
    await write(fs, `${HOME}/versions/0.2.0/package.json`, "{}");

    expect(await installedVersions({ fs, home: HOME })).toEqual(["0.1.3"]);
  });

  /** An install that was interrupted leaves one of these behind. */
  it("does not count a staging directory", async () => {
    const fs = await withVersions(["0.1.3"]);
    await addVersion(fs, ".0.2.0.part");

    expect(await installedVersions({ fs, home: HOME })).toEqual(["0.1.3"]);
  });

  it("finds none on a machine with nothing", async () => {
    expect(await installedVersions({ fs: createMemoryFs(), home: HOME })).toEqual([]);
  });
});

describe("the default version", () => {
  it("is the one the file names", async () => {
    const fs = await withVersions(["0.1.3", "0.2.0"]);
    await write(fs, `${HOME}/default`, "0.2.0\n");

    expect(await defaultVersion({ fs, home: HOME })).toBe("0.2.0");
  });

  /** Removing a version should not leave every directory pointing at nothing. */
  it("is nothing when it names a version that is gone", async () => {
    const fs = await withVersions(["0.1.3"]);
    await write(fs, `${HOME}/default`, "0.9.9\n");

    expect(await defaultVersion({ fs, home: HOME })).toBeUndefined();
  });

  it("is nothing when no default was chosen", async () => {
    const fs = await withVersions(["0.1.3"]);

    expect(await defaultVersion({ fs, home: HOME })).toBeUndefined();
  });
});

describe("what to do about a directory", () => {
  it("runs the version a manifest pins", async () => {
    const fs = await withVersions(["0.1.3", "0.2.0"]);
    await write(fs, "/work/api/venn.toml", '[package]\nvenn = "0.2.0"\n');

    const plan = await planFor({ fs, home: HOME, directory: "/work/api" });

    expect(plan).toEqual({
      kind: "run",
      version: "0.2.0",
      entry: "/home/v/.venn/versions/0.2.0/dist/bin/venn-run.mjs",
    });
  });

  it("runs the newest matching a range", async () => {
    const fs = await withVersions(["0.2.0", "0.2.4", "1.0.0"]);
    await write(fs, "/work/venn.toml", '[package]\nvenn = "0.2.x"\n');

    const plan = await planFor({ fs, home: HOME, directory: "/work" });

    expect(plan.kind === "run" && plan.version).toBe("0.2.4");
  });

  it("runs the newest installed when nothing asks", async () => {
    const fs = await withVersions(["0.1.3", "0.2.0"]);

    const plan = await planFor({ fs, home: HOME, directory: "/work" });

    expect(plan.kind === "run" && plan.version).toBe("0.2.0");
  });

  it("prefers the chosen default over the newest", async () => {
    const fs = await withVersions(["0.1.3", "0.2.0"]);
    await write(fs, `${HOME}/default`, "0.1.3");

    const plan = await planFor({ fs, home: HOME, directory: "/work" });

    expect(plan.kind === "run" && plan.version).toBe("0.1.3");
  });

  it("points at the server when that is what was asked for", async () => {
    const fs = await withVersions(["0.2.0"]);

    const plan = await planFor({ fs, home: HOME, directory: "/work", kind: "lsp" });

    expect(plan.kind === "run" && plan.entry).toContain("venn-lsp.mjs");
  });

  /**
   * Someone who pinned a version and ran a command has already said which one
   * they want, so fetching it beats asking whether to.
   */
  it("installs what was pinned when it is not there", async () => {
    const fs = await withVersions(["0.1.3"]);
    await write(fs, "/work/venn.toml", '[package]\nvenn = "0.2.x"\n');

    const plan = await planFor({ fs, home: HOME, directory: "/work" });

    expect(plan.kind).toBe("install");
    expect(plan.kind === "install" && plan.request).toBe("0.2.x");
    expect(plan.kind === "install" && plan.reason).toContain("0.2.x");
  });

  it("installs the newest when a machine has nothing at all", async () => {
    const fs = createMemoryFs();
    await write(fs, "/work/readme.md", "x");

    const plan = await planFor({ fs, home: HOME, directory: "/work" });

    expect(plan.kind).toBe("install");
    expect(plan.kind === "install" && plan.request).toBe("*");
  });
});
