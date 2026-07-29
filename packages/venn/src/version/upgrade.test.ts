import { createMemoryFs, type FileSystem } from "@venn-lang/contracts";
import { beforeAll, describe, expect, it } from "vitest";
import type { Surroundings } from "../execute.js";
import { upgradeCommand } from "./upgrade-command.js";

const HOME = "/home/v/.venn";

interface Watched {
  where: Surroundings;
  said: string[];
}

/** One tar entry: a 512 byte header, then the content padded to 512. */
function entry(name: string, content: string): Uint8Array {
  const bytes = new TextEncoder().encode(content);
  const header = new Uint8Array(512);
  header.set(new TextEncoder().encode(name.slice(0, 100)), 0);
  header.set(new TextEncoder().encode(bytes.length.toString(8).padStart(11, "0")), 124);
  header[156] = "0".charCodeAt(0);
  const padded = new Uint8Array(Math.ceil(bytes.length / 512) * 512);
  padded.set(bytes);
  return concat([header, padded]);
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * A real tarball, so upgrading goes through the download and the integrity
 * check rather than around them. It carries the one thing that makes a version
 * usable: a manifest naming an entry point, and the entry point.
 *
 * Two blocks of zeroes at the end, which is how an archive says it is over.
 */
async function tarball(): Promise<Uint8Array> {
  const manifest = JSON.stringify({ bin: { "venn-run": "./dist/bin/venn-run.mjs" } });
  const tar = concat([
    entry("package/package.json", manifest),
    entry("package/dist/bin/venn-run.mjs", "x"),
    new Uint8Array(1024),
  ]);
  const stream = new Blob([tar as BlobPart]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The registry, offering exactly the bytes above under the hash they hash to. */
let download: Uint8Array;
let catalogue: unknown;

beforeAll(async () => {
  download = await tarball();
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-512", download as BufferSource));
  const integrity = `sha512-${btoa(String.fromCharCode(...digest))}`;
  catalogue = {
    "dist-tags": { latest: "0.2.0" },
    versions: {
      "0.1.3": { dist: { tarball: "https://r/a.tgz", integrity } },
      "0.2.0": { dist: { tarball: "https://r/b.tgz", integrity } },
    },
  };
});

function surroundings(options: { unreachable?: boolean } = {}): Watched {
  const said: string[] = [];
  const where: Surroundings = {
    fs: createMemoryFs(),
    home: HOME,
    cwd: "/work",
    fetchJson: async () => {
      if (options.unreachable) throw new Error("the registry is not answering");
      return catalogue;
    },
    fetchBytes: async () => download,
    handOver: async () => 0,
    say: (line) => said.push(line),
  };
  return { where, said };
}

async function install(fs: FileSystem, version: string): Promise<void> {
  const root = `${HOME}/versions/${version}`;
  const manifest = JSON.stringify({ bin: { "venn-run": "./dist/bin/venn-run.mjs" } });
  await write(fs, `${root}/package.json`, manifest);
  await write(fs, `${root}/dist/bin/venn-run.mjs`, "x");
}

async function write(fs: FileSystem, path: string, content: string): Promise<void> {
  await fs.write(path, new TextEncoder().encode(content));
}

async function read(fs: FileSystem, path: string): Promise<string> {
  return new TextDecoder().decode(await fs.read(path)).trim();
}

function upgrade(watched: Watched): Promise<number | undefined> {
  return upgradeCommand({ argv: ["upgrade"], where: watched.where });
}

describe("venn upgrade", () => {
  it("is not something any other word triggers", async () => {
    const watched = surroundings();

    expect(await upgradeCommand({ argv: ["test"], where: watched.where })).toBeUndefined();
    expect(await upgradeCommand({ argv: ["version"], where: watched.where })).toBeUndefined();
    expect(await upgradeCommand({ argv: [], where: watched.where })).toBeUndefined();
  });

  /**
   * The whole reason this moved here. The old one ran `npm install -g`, which
   * after the split fetched a second compiler to a place nothing looks in, so
   * the upgrade appeared to work and changed nothing.
   */
  it("fetches the newest and makes it the default", async () => {
    const watched = surroundings();
    await install(watched.where.fs, "0.1.3");
    await write(watched.where.fs, `${HOME}/default`, "0.1.3\n");

    expect(await upgrade(watched)).toBe(0);

    expect(await read(watched.where.fs, `${HOME}/default`)).toBe("0.2.0");
    expect(await read(watched.where.fs, `${HOME}/versions/0.2.0/package.json`)).toContain(
      "venn-run",
    );
    expect(watched.said).toContain("Installing 0.2.0");
    expect(watched.said).toContain("Now using 0.2.0 by default");
  });

  it("does not fetch again when the newest is already here", async () => {
    const watched = surroundings();
    await install(watched.where.fs, "0.2.0");

    expect(await upgrade(watched)).toBe(0);

    expect(watched.said).toContain("0.2.0 is already installed");
    expect(await read(watched.where.fs, `${HOME}/default`)).toBe("0.2.0");
  });

  /**
   * A project that pins a version is shared with other people, and upgrading
   * one machine is not a reason to move it. Saying so is what keeps the next
   * ten minutes from going on why the old version still runs.
   */
  it("leaves a pinned directory alone, and says which file pins it", async () => {
    const watched = surroundings();
    await write(watched.where.fs, "/work/.venn-version", "0.1.3\n");

    expect(await upgrade(watched)).toBe(0);

    expect(await read(watched.where.fs, "/work/.venn-version")).toBe("0.1.3");
    expect(watched.said.join("\n")).toContain("This directory still uses 0.1.3");
    expect(watched.said.join("\n")).toContain(".venn-version");
  });

  it("says nothing about pins when the directory has none", async () => {
    const watched = surroundings();

    await upgrade(watched);

    expect(watched.said.join("\n")).not.toContain("This directory still uses");
  });

  it("fails without touching the default when the registry cannot be reached", async () => {
    const watched = surroundings({ unreachable: true });
    await install(watched.where.fs, "0.1.3");
    await write(watched.where.fs, `${HOME}/default`, "0.1.3\n");

    expect(await upgrade(watched)).toBe(1);

    expect(await read(watched.where.fs, `${HOME}/default`)).toBe("0.1.3");
    expect(watched.said.join("\n")).toContain("registry could not be reached");
  });
});
