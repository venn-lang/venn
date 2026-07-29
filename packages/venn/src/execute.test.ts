import { createMemoryFs, type FileSystem } from "@venn-lang/contracts";
import { describe, expect, it } from "vitest";
import { execute, type Surroundings } from "./execute.js";

const HOME = "/home/v/.venn";

/** A tarball holding a manifest and the entry point it declares. */
async function tarball(): Promise<{ bytes: Uint8Array; integrity: string }> {
  const manifest = JSON.stringify({ bin: { "venn-run": "./dist/bin/venn-run.mjs" } });
  const archive = concat([
    entry("package/package.json", manifest),
    entry("package/dist/bin/venn-run.mjs", "#!/usr/bin/env node\n"),
    new Uint8Array(1024),
  ]);
  const bytes = await gzip(archive);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-512", bytes as BufferSource));
  return { bytes, integrity: `sha512-${btoa(String.fromCharCode(...digest))}` };
}

/** One tar entry: a 512 byte header, then the content padded to 512. */
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

/** The registry document, holding the hash of the tarball actually served. */
function catalogueFor(integrity: string): unknown {
  return {
    "dist-tags": { latest: "0.2.0" },
    versions: {
      "0.1.0": { dist: { tarball: "https://r/0.1.0.tgz", integrity } },
      "0.2.0": { dist: { tarball: "https://r/0.2.0.tgz", integrity } },
    },
  };
}

interface Watched {
  where: Surroundings;
  said: string[];
  ran: { entry: string; args: readonly string[] }[];
}

async function surroundings(files: Record<string, string> = {}): Promise<Watched> {
  const served = await tarball();
  const said: string[] = [];
  const ran: { entry: string; args: readonly string[] }[] = [];
  const where: Surroundings = {
    fs: await filesystemWith(files),
    home: HOME,
    cwd: "/work",
    fetchJson: async () => catalogueFor(served.integrity),
    fetchBytes: async () => served.bytes,
    handOver: async (args) => watch(ran, args),
    say: (line) => said.push(line),
  };
  return { said, ran, where };
}

/** Records what would have run, and reports the success it would have had. */
async function watch(
  ran: { entry: string; args: readonly string[] }[],
  args: { entry: string; args: readonly string[] },
): Promise<number> {
  ran.push(args);
  return 0;
}

async function filesystemWith(files: Record<string, string>): Promise<FileSystem> {
  const fs = createMemoryFs();
  for (const [path, content] of Object.entries(files)) {
    await fs.write(path, new TextEncoder().encode(content));
  }
  return fs;
}

/** A version already on the machine, declaring what it offers. */
async function alreadyInstalled(fs: FileSystem, version: string): Promise<void> {
  const root = `${HOME}/versions/${version}`;
  const manifest = JSON.stringify({ bin: { "venn-run": "./dist/bin/venn-run.mjs" } });
  await fs.write(`${root}/package.json`, new TextEncoder().encode(manifest));
  await fs.write(`${root}/dist/bin/venn-run.mjs`, new TextEncoder().encode("#!/usr/bin/env node"));
}

describe("running a command", () => {
  it("hands it to the installed version, arguments untouched", async () => {
    const watched = await surroundings();
    await alreadyInstalled(watched.where.fs, "0.2.0");

    const code = await execute({ argv: ["test", "--reporter", "dot"], where: watched.where });

    expect(code).toBe(0);
    expect(watched.ran).toEqual([
      {
        entry: `${HOME}/versions/0.2.0/dist/bin/venn-run.mjs`,
        args: ["test", "--reporter", "dot"],
      },
    ]);
  });

  it("gives back whatever the language exited with", async () => {
    const watched = await surroundings();
    await alreadyInstalled(watched.where.fs, "0.2.0");
    const where = { ...watched.where, handOver: async () => 3 };

    expect(await execute({ argv: ["test"], where })).toBe(3);
  });

  it("says nothing when there is nothing to say", async () => {
    const watched = await surroundings();
    await alreadyInstalled(watched.where.fs, "0.2.0");

    await execute({ argv: ["test"], where: watched.where });

    expect(watched.said).toEqual([]);
  });
});

describe("when the version is not there", () => {
  it("fetches it, says so, and then hands over", async () => {
    const watched = await surroundings({ "/work/venn.toml": '[package]\nvenn = "0.2.0"\n' });

    const code = await execute({ argv: ["test"], where: watched.where });

    expect(watched.said).toEqual(["venn: installing 0.2.0"]);
    expect(watched.ran).toHaveLength(1);
    expect(code).toBe(0);
  });

  /** A note about installing must not land in the middle of piped output. */
  it("says it on the channel that is not the command's output", async () => {
    const watched = await surroundings();

    await execute({ argv: ["test"], where: watched.where });

    expect(watched.said[0]).toContain("installing");
  });

  it("stops when the registry has nothing matching", async () => {
    const watched = await surroundings({ "/work/venn.toml": '[package]\nvenn = "9.x"\n' });

    const code = await execute({ argv: ["test"], where: watched.where });

    expect(code).toBe(1);
    expect(watched.said[0]).toContain("no published version matches 9.x");
    expect(watched.ran).toEqual([]);
  });

  it("stops when the registry cannot be reached", async () => {
    const watched = await surroundings();
    const where = {
      ...watched.where,
      fetchJson: async () => {
        throw new Error("offline");
      },
    };

    const code = await execute({ argv: ["test"], where });

    expect(code).toBe(1);
    expect(watched.said[0]).toContain("could not be reached");
  });
});
