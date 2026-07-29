import { createMemoryFs, type FileSystem } from "@venn-lang/contracts";
import { describe, expect, it } from "vitest";
import type { Release } from "../registry/index.js";
import { installVersion } from "./install-version.js";
import { readTar } from "./read-tar.js";
import { safePathFor } from "./safe-path.js";
import { matchesIntegrity } from "./verify-integrity.js";

/** One tar entry: a 512 byte header, then the content padded to 512. */
function entry(name: string, content: string, type = "0"): Uint8Array {
  const bytes = new TextEncoder().encode(content);
  const header = new Uint8Array(512);
  header.set(new TextEncoder().encode(name.slice(0, 100)), 0);
  header.set(new TextEncoder().encode(bytes.length.toString(8).padStart(11, "0")), 124);
  header[156] = type.charCodeAt(0);
  const padded = new Uint8Array(Math.ceil(bytes.length / 512) * 512);
  padded.set(bytes);
  return concat([header, padded]);
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Two blocks of zeroes, which is how an archive says it is over. */
const END = new Uint8Array(1024);

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function releaseFrom(bytes: Uint8Array): Promise<Release> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-512", bytes as BufferSource));
  const base64 = btoa(String.fromCharCode(...digest));
  return { version: "0.2.0", tarball: "https://r/x.tgz", integrity: `sha512-${base64}` };
}

async function read(fs: FileSystem, path: string): Promise<string> {
  return new TextDecoder().decode(await fs.read(path));
}

describe("reading a tar", () => {
  it("takes the regular files, with their content", () => {
    const files = readTar(
      concat([entry("package/a.js", "one"), entry("package/b.js", "two"), END]),
    );

    expect(files.map((file) => file.name)).toEqual(["package/a.js", "package/b.js"]);
    expect(new TextDecoder().decode(files[0]?.bytes)).toBe("one");
  });

  /** A package tarball has no business holding a link or a device node. */
  it("skips everything that is not a regular file", () => {
    const archive = concat([
      entry("package/dir/", "", "5"),
      entry("package/link", "elsewhere", "2"),
      entry("package/real.js", "kept"),
      END,
    ]);

    expect(readTar(archive).map((file) => file.name)).toEqual(["package/real.js"]);
  });

  it("stops at the end of the archive rather than reading past it", () => {
    const archive = concat([entry("package/a.js", "one"), END, entry("package/never.js", "x")]);

    expect(readTar(archive)).toHaveLength(1);
  });

  it("reads an empty archive as empty", () => {
    expect(readTar(END)).toEqual([]);
    expect(readTar(new Uint8Array(0))).toEqual([]);
  });
});

describe("deciding where an entry may go", () => {
  it("strips the prefix every npm tarball uses", () => {
    expect(safePathFor("package/dist/index.js")).toBe("dist/index.js");
  });

  /**
   * A name in an archive is a claim about where its content should end up, made
   * by whoever built it. `../../.ssh/authorized_keys` is a valid tar entry.
   */
  it("refuses a name that climbs out", () => {
    expect(safePathFor("package/../../.ssh/authorized_keys")).toBeUndefined();
    expect(safePathFor("package/dist/../../../etc/passwd")).toBeUndefined();
    expect(safePathFor("../package/x.js")).toBeUndefined();
  });

  it("refuses a name anchored to a root or a drive", () => {
    expect(safePathFor("package//etc/passwd")).toBeUndefined();
    expect(safePathFor("package/C:/windows/system32/x")).toBeUndefined();
  });

  it("refuses a backslash used to smuggle one past", () => {
    expect(safePathFor("package/..\\..\\.ssh\\authorized_keys")).toBeUndefined();
  });

  it("refuses anything outside the prefix", () => {
    expect(safePathFor("elsewhere/x.js")).toBeUndefined();
    expect(safePathFor("package")).toBeUndefined();
  });
});

describe("checking what was downloaded", () => {
  const bytes = new TextEncoder().encode("the tarball");

  it("accepts the bytes the registry published", async () => {
    const release = await releaseFrom(bytes);

    expect(await matchesIntegrity({ bytes, integrity: release.integrity })).toBe(true);
  });

  it("rejects anything else", async () => {
    const release = await releaseFrom(bytes);
    const tampered = new TextEncoder().encode("the tarball, altered");

    expect(await matchesIntegrity({ bytes: tampered, integrity: release.integrity })).toBe(false);
  });

  /** An algorithm nobody recognises is not a reason to skip the check. */
  it("rejects a hash it cannot understand rather than waving it through", async () => {
    for (const integrity of ["", "sha512", "md5-abc", "nonsense"]) {
      expect(await matchesIntegrity({ bytes, integrity })).toBe(false);
    }
  });
});

describe("installing a version", () => {
  async function install(archive: Uint8Array, fs = createMemoryFs()) {
    const tarball = await gzip(archive);
    const release = await releaseFrom(tarball);
    const where = await installVersion({
      fs,
      release,
      into: "/home/v/.venn/versions",
      fetchBytes: async () => tarball,
    });
    return { fs, where };
  }

  it("puts the files where the version belongs", async () => {
    const archive = concat([
      entry("package/bin/venn-run.mjs", "the runner"),
      entry("package/package.json", '{"name":"x"}'),
      END,
    ]);

    const { fs, where } = await install(archive);

    expect(where).toBe("/home/v/.venn/versions/0.2.0");
    expect(await read(fs, `${where}/bin/venn-run.mjs`)).toBe("the runner");
    expect(await read(fs, `${where}/package.json`)).toBe('{"name":"x"}');
  });

  it("leaves out an entry that tried to climb out, and keeps the rest", async () => {
    const archive = concat([
      entry("package/../../../tmp/owned", "no"),
      entry("package/fine.js", "yes"),
      END,
    ]);

    const { fs, where } = await install(archive);

    expect(await read(fs, `${where}/fine.js`)).toBe("yes");
    expect(await fs.exists("/tmp/owned")).toBe(false);
  });

  /**
   * A half-written version directory is worse than none: the next command finds
   * it, believes it, and fails somewhere further away.
   */
  it("leaves nothing behind when the download is not what was published", async () => {
    const fs = createMemoryFs();
    const tarball = await gzip(concat([entry("package/a.js", "x"), END]));
    const release = { ...(await releaseFrom(tarball)), integrity: "sha512-somethingelse" };

    const failed = installVersion({
      fs,
      release,
      into: "/versions",
      fetchBytes: async () => tarball,
    });

    await expect(failed).rejects.toThrow("does not match the hash");
    expect(await fs.exists("/versions/0.2.0")).toBe(false);
  });

  it("refuses an archive that holds nothing installable", async () => {
    const fs = createMemoryFs();
    const tarball = await gzip(concat([entry("elsewhere/x.js", "no"), END]));

    const failed = installVersion({
      fs,
      release: await releaseFrom(tarball),
      into: "/versions",
      fetchBytes: async () => tarball,
    });

    await expect(failed).rejects.toThrow("no files that could be installed");
    expect(await fs.exists("/versions/0.2.0")).toBe(false);
  });

  it("replaces a version that was already there", async () => {
    const fs = createMemoryFs();
    await fs.write("/home/v/.venn/versions/0.2.0/stale.js", new TextEncoder().encode("old"));

    const { where } = await install(concat([entry("package/fresh.js", "new"), END]), fs);

    expect(await read(fs, `${where}/fresh.js`)).toBe("new");
    expect(await fs.exists(`${where}/stale.js`)).toBe(false);
  });
});
