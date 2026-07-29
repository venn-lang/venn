import type { FileSystem } from "@venn-lang/contracts";
import type { Release } from "../registry/index.js";
import { readTar } from "./read-tar.js";
import { safePathFor } from "./safe-path.js";
import type { TarFile } from "./tar.types.js";
import { verifyIntegrity } from "./verify-integrity.js";

/** How the tarball is fetched, injected so a test needs no network. */
export type FetchBytes = (url: string) => Promise<Uint8Array>;

/**
 * Puts a published version on the machine, under the directory given.
 *
 * Unpacked beside its destination first and moved into place at the end, so an
 * interrupted install leaves nothing that looks finished. A half-written
 * version directory is worse than none: the next command would find it, believe
 * it, and fail somewhere further away.
 *
 * @param fs Where to write.
 * @param release Which version, from `releaseFor`.
 * @param into Where versions live, usually `~/.venn/versions`.
 * @param fetchBytes How to fetch the tarball.
 * @returns Where it was put.
 * @throws Error when the download does not match the hash the registry
 * published, or when the archive holds nothing that may be written.
 */
export async function installVersion(args: {
  fs: FileSystem;
  release: Release;
  into: string;
  fetchBytes: FetchBytes;
}): Promise<string> {
  const bytes = await args.fetchBytes(args.release.tarball);
  await verifyIntegrity({ bytes, release: args.release });
  const files = readTar(await gunzip(bytes));
  const staging = `${args.into}/.${args.release.version}.part`;
  await args.fs.removeAll(staging);
  await writeAll({ fs: args.fs, files, into: staging, version: args.release.version });
  return finish({ fs: args.fs, from: staging, to: `${args.into}/${args.release.version}` });
}

async function writeAll(args: {
  fs: FileSystem;
  files: readonly TarFile[];
  into: string;
  version: string;
}): Promise<void> {
  let written = 0;
  for (const file of args.files) {
    const path = safePathFor(file.name);
    if (path === undefined) continue;
    await args.fs.write(`${args.into}/${path}`, file.bytes);
    written += 1;
  }
  if (written > 0) return;
  await args.fs.removeAll(args.into);
  throw new Error(`the tarball for ${args.version} held no files that could be installed`);
}

/**
 * The last step, and the only one that makes the version visible. Anything that
 * failed before this leaves a dot-prefixed directory, which the next install of
 * the same version clears on its way past.
 */
async function finish(args: { fs: FileSystem; from: string; to: string }): Promise<string> {
  await args.fs.removeAll(args.to);
  for (const path of await filesUnder(args.fs, args.from)) {
    await args.fs.write(`${args.to}/${path}`, await args.fs.read(`${args.from}/${path}`));
  }
  await args.fs.removeAll(args.from);
  return args.to;
}

/** Every file under a directory, as paths relative to it. */
async function filesUnder(fs: FileSystem, directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await fs.list(directory)) {
    if (!entry.directory) {
      found.push(entry.name);
      continue;
    }
    const nested = await filesUnder(fs, `${directory}/${entry.name}`);
    found.push(...nested.map((path) => `${entry.name}/${path}`));
  }
  return found;
}

/** `DecompressionStream` is web standard, so this needs nothing from Node. */
async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
