import { createMemoryFs, type FileSystem } from "@venn-lang/contracts";
import { installedVersions } from "@venn-lang/toolchain";
import { describe, expect, it } from "vitest";
import { type Preparation, prepare, realPreparation } from "./prepare.js";

const HOME = "/home/v/.venn";

/** A tarball holding a manifest and the entry point it declares. */
async function tarball(): Promise<{ bytes: Uint8Array; integrity: string }> {
  const manifest = JSON.stringify({ bin: { "venn-run": "./dist/bin/venn-run.mjs" } });
  const bytes = await gzip(
    concat([
      entry("package/package.json", manifest),
      entry("package/dist/bin/venn-run.mjs", "#!/usr/bin/env node"),
      new Uint8Array(1024),
    ]),
  );
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-512", bytes as BufferSource));
  return { bytes, integrity: `sha512-${btoa(String.fromCharCode(...digest))}` };
}

function entry(name: string, content: string): Uint8Array {
  const bytes = new TextEncoder().encode(content);
  const header = new Uint8Array(512);
  header.set(new TextEncoder().encode(name), 0);
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

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function catalogueFor(integrity: string): unknown {
  return {
    "dist-tags": { latest: "0.2.0" },
    versions: { "0.2.0": { dist: { tarball: "https://r/a.tgz", integrity } } },
  };
}

interface Watched {
  where: Preparation;
  said: string[];
  fetched: string[];
}

function preparation(overrides: Partial<Preparation> = {}): Watched {
  const said: string[] = [];
  const fetched: string[] = [];
  const where: Preparation = {
    fs: createMemoryFs(),
    home: HOME,
    fetchJson: async () => catalogueFor("sha512-a"),
    fetchBytes: async (url) => record(fetched, url),
    say: (line) => said.push(line),
    ...overrides,
  };
  return { said, fetched, where };
}

/** Notes what would have been downloaded, and hands back nothing. */
async function record(fetched: string[], url: string): Promise<Uint8Array> {
  fetched.push(url);
  return new Uint8Array(0);
}

async function alreadyInstalled(fs: FileSystem): Promise<void> {
  const root = `${HOME}/versions/0.1.3`;
  const manifest = JSON.stringify({ bin: { "venn-run": "./dist/bin/venn-run.mjs" } });
  await fs.write(`${root}/package.json`, new TextEncoder().encode(manifest));
  await fs.write(`${root}/dist/bin/venn-run.mjs`, new TextEncoder().encode("x"));
}

describe("preparing on install", () => {
  /** The whole point: the first command should not have to wait. */
  it("installs the newest version and says it is ready", async () => {
    const served = await tarball();
    const watched = preparation({
      fetchJson: async () => catalogueFor(served.integrity),
      fetchBytes: async () => served.bytes,
    });

    await prepare(watched.where);

    expect(watched.said).toEqual(["venn: 0.2.0 ready"]);
    expect(await installedVersions(watched.where)).toEqual(["0.2.0"]);
  });

  /**
   * The install must not fail over this. It is an optimisation: the language
   * arrives on first use instead, a few seconds later, once.
   */
  it("does not throw when the registry cannot be reached", async () => {
    const watched = preparation({
      fetchJson: async () => {
        throw new Error("offline");
      },
    });

    await expect(prepare(watched.where)).resolves.toBeUndefined();
    expect(watched.said[0]).toContain("fetched on first use");
  });

  it("does not throw when the download fails", async () => {
    const watched = preparation({
      fetchBytes: async () => {
        throw new Error("connection reset");
      },
    });

    await expect(prepare(watched.where)).resolves.toBeUndefined();
    expect(watched.said[0]).toContain("fetched on first use");
  });

  /** Reinstalling the orchestrator should not refetch a language that is here. */
  it("fetches nothing when a version is already installed", async () => {
    const watched = preparation();
    await alreadyInstalled(watched.where.fs);

    await prepare(watched.where);

    expect(watched.fetched).toEqual([]);
    expect(watched.said).toEqual([]);
  });
});

describe("the real surroundings", () => {
  /**
   * Weak on logic and worth having: it is the wiring that turns names into a
   * working thing, and a rename that breaks it fails here rather than during
   * somebody's install.
   */
  it("are built from what the machine offers", () => {
    const where = realPreparation();

    expect(where.home).toMatch(/\.venn$|venn$/);
    expect(typeof where.fetchJson).toBe("function");
    expect(typeof where.fetchBytes).toBe("function");
    expect(typeof where.fs.read).toBe("function");
    expect(typeof where.say).toBe("function");
  });

  it("keep VENN_HOME when it is set", () => {
    const before = process.env.VENN_HOME;
    process.env.VENN_HOME = "/opt/venn-test";
    try {
      expect(realPreparation().home).toBe("/opt/venn-test");
    } finally {
      if (before === undefined) delete process.env.VENN_HOME;
      else process.env.VENN_HOME = before;
    }
  });
});
