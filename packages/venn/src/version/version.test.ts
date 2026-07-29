import { createMemoryFs, type FileSystem } from "@venn-lang/contracts";
import { describe, expect, it } from "vitest";
import type { Surroundings } from "../execute.js";
import { versionCommand } from "./version-command.js";

const HOME = "/home/v/.venn";

interface Watched {
  where: Surroundings;
  said: string[];
}

/** What the registry offers, which no test here downloads. */
const CATALOGUE = {
  "dist-tags": { latest: "0.2.0" },
  versions: {
    "0.1.3": { dist: { tarball: "https://r/a.tgz", integrity: "sha512-a" } },
    "0.2.0": { dist: { tarball: "https://r/b.tgz", integrity: "sha512-b" } },
  },
};

function surroundings(): Watched {
  const said: string[] = [];
  const where: Surroundings = {
    fs: createMemoryFs(),
    home: HOME,
    cwd: "/work",
    fetchJson: async () => CATALOGUE,
    fetchBytes: async () => new Uint8Array(0),
    handOver: async () => 0,
    say: (line) => said.push(line),
  };
  return { where, said };
}

/** A version on the machine, declaring the entry point that makes it usable. */
async function install(fs: FileSystem, version: string): Promise<void> {
  const root = `${HOME}/versions/${version}`;
  const manifest = JSON.stringify({ bin: { "venn-run": "./dist/bin/venn-run.mjs" } });
  await fs.write(`${root}/package.json`, new TextEncoder().encode(manifest));
  await fs.write(`${root}/dist/bin/venn-run.mjs`, new TextEncoder().encode("x"));
}

async function run(watched: Watched, argv: readonly string[]): Promise<number | undefined> {
  return versionCommand({ argv, where: watched.where });
}

async function read(fs: FileSystem, path: string): Promise<string> {
  return new TextDecoder().decode(await fs.read(path)).trim();
}

describe("what the orchestrator answers itself", () => {
  it("takes only `version`, and hands everything else over", async () => {
    const watched = surroundings();

    expect(await run(watched, ["test"])).toBeUndefined();
    expect(await run(watched, ["install", "zod"])).toBeUndefined();
    expect(await run(watched, ["--version"])).toBeUndefined();
    expect(await run(watched, ["remove", "zod"])).toBeUndefined();
  });

  it("says what it offers when asked for nothing in particular", async () => {
    const watched = surroundings();

    expect(await run(watched, ["version"])).toBe(1);
    expect(watched.said.join("\n")).toContain("venn version install");
  });

  it("says the same for a subcommand it does not have", async () => {
    const watched = surroundings();

    expect(await run(watched, ["version", "upgrade"])).toBe(1);
  });
});

describe("listing", () => {
  it("says so plainly when there is nothing yet", async () => {
    const watched = surroundings();

    expect(await run(watched, ["version", "list"])).toBe(0);
    expect(watched.said[0]).toContain("No versions installed");
  });

  /** Someone asking has usually just been surprised by which one they are on. */
  it("marks the one in use and says what decided it", async () => {
    const watched = surroundings();
    await install(watched.where.fs, "0.1.3");
    await install(watched.where.fs, "0.2.0");

    await run(watched, ["version", "list"]);

    expect(watched.said).toContain("* 0.2.0");
    expect(watched.said).toContain("  0.1.3");
    expect(watched.said.join("\n")).toContain("the newest installed");
  });

  it("names the file when a pin decided", async () => {
    const watched = surroundings();
    await install(watched.where.fs, "0.1.3");
    await watched.where.fs.write("/work/.venn-version", new TextEncoder().encode("0.1.3"));

    await run(watched, ["version", "list"]);

    expect(watched.said.join("\n")).toContain("/work/.venn-version");
  });
});

describe("pinning", () => {
  it("writes the pin for this directory", async () => {
    const watched = surroundings();
    await install(watched.where.fs, "0.1.3");

    expect(await run(watched, ["version", "use", "0.1.3"])).toBe(0);
    expect(await read(watched.where.fs, "/work/.venn-version")).toBe("0.1.3");
  });

  /**
   * A manifest is under review and belongs to whoever wrote it. A command that
   * rewrites one shows up in somebody's diff unannounced.
   */
  it("does not touch a venn.toml that is there", async () => {
    const watched = surroundings();
    const manifest = '[package]\nname = "api"\n';
    await watched.where.fs.write("/work/venn.toml", new TextEncoder().encode(manifest));
    await install(watched.where.fs, "0.1.3");

    await run(watched, ["version", "use", "0.1.3"]);

    expect(await read(watched.where.fs, "/work/venn.toml")).toBe(manifest.trim());
  });

  it("accepts a range, and says when nothing matching is installed yet", async () => {
    const watched = surroundings();

    expect(await run(watched, ["version", "use", "0.2.x"])).toBe(0);
    expect(watched.said[0]).toContain("not installed yet");
  });

  it("refuses something that is not a version at all", async () => {
    const watched = surroundings();

    expect(await run(watched, ["version", "use", "the newest one"])).toBe(1);
    expect(watched.said[0]).toContain("not a version or a range");
  });

  /** The default answers for everything that did not ask, so it names one. */
  it("resolves a range to one version when setting the default", async () => {
    const watched = surroundings();
    await install(watched.where.fs, "0.1.3");
    await install(watched.where.fs, "0.2.0");

    expect(await run(watched, ["version", "use", "0.x", "--global"])).toBe(0);
    expect(await read(watched.where.fs, `${HOME}/default`)).toBe("0.2.0");
  });

  it("refuses a default that is not installed", async () => {
    const watched = surroundings();

    expect(await run(watched, ["version", "use", "0.2.0", "--global"])).toBe(1);
    expect(watched.said[0]).toContain("Install it first");
  });
});

describe("removing", () => {
  it("takes a version off the machine", async () => {
    const watched = surroundings();
    await install(watched.where.fs, "0.1.3");
    await install(watched.where.fs, "0.2.0");
    await watched.where.fs.write("/work/.venn-version", new TextEncoder().encode("0.2.0"));

    expect(await run(watched, ["version", "remove", "0.1.3"])).toBe(0);
    expect(await watched.where.fs.exists(`${HOME}/versions/0.1.3/package.json`)).toBe(false);
  });

  it("refuses one that is not there", async () => {
    const watched = surroundings();

    expect(await run(watched, ["version", "remove", "9.9.9"])).toBe(1);
    expect(watched.said[0]).toContain("not installed");
  });

  /** Otherwise the next command in this directory fails, somewhere else. */
  it("refuses the one this directory is pinned to", async () => {
    const watched = surroundings();
    await install(watched.where.fs, "0.1.3");
    await watched.where.fs.write("/work/.venn-version", new TextEncoder().encode("0.1.3"));

    expect(await run(watched, ["version", "remove", "0.1.3"])).toBe(1);
    expect(watched.said[0]).toContain("what this directory uses");
  });

  it("refuses the default, and says how to change it", async () => {
    const watched = surroundings();
    await install(watched.where.fs, "0.1.3");
    await watched.where.fs.write(`${HOME}/default`, new TextEncoder().encode("0.1.3"));

    expect(await run(watched, ["version", "remove", "0.1.3"])).toBe(1);
    expect(watched.said[0]).toContain("venn version use --global");
  });
});

describe("installing", () => {
  it("says what it needs when given nothing", async () => {
    const watched = surroundings();

    expect(await run(watched, ["version", "install"])).toBe(1);
  });

  it("stops when the registry has nothing matching", async () => {
    const watched = surroundings();

    expect(await run(watched, ["version", "install", "9.x"])).toBe(1);
    expect(watched.said[0]).toContain("no published version matches");
  });

  it("does not fetch one that is already here", async () => {
    const watched = surroundings();
    await install(watched.where.fs, "0.2.0");

    expect(await run(watched, ["version", "install", "latest"])).toBe(0);
    expect(watched.said[0]).toContain("already installed");
  });
});
