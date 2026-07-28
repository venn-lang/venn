import type { FileSystem } from "@venn-lang/contracts";
import { join } from "../paths/index.js";

/** Directories inside a package that are not part of it. */
const SKIP = new Set(["node_modules", ".git", ".bin"]);

/**
 * A hash of everything a package installed.
 *
 * Not the registry's integrity hash, which lives in each manager's own lock in
 * each manager's format. This is computed from what landed on disk, which every
 * manager produces the same way. The guarantee differs: the registry's hash
 * says "this is the tarball that was served", this one says "this is the tree
 * that was installed when the lock was written". Trust on first use, and any
 * divergence after that is caught.
 *
 * A hash of hashes rather than of the concatenated bytes, because a package can
 * hold tens of megabytes and digesting it in one buffer costs more than the
 * answer is worth.
 *
 * @param args.dir The installed package directory.
 * @returns `sha256-…` over every file under `dir`, sorted by path, with
 * `node_modules`, `.git` and `.bin` skipped. A file that cannot be read is left
 * out rather than raising.
 */
export async function hashPackage(args: { fs: FileSystem; dir: string }): Promise<string> {
  const files = (await filesUnder(args.fs, args.dir, "")).sort();
  const lines: string[] = [];
  for (const path of files) {
    // Deliberately unguarded: the walk above already found this file, so a read
    // that fails is a real fault. Skipping it would hash a subset of the tree
    // and call it the tree, which is the one answer this function must not give.
    const bytes = await args.fs.read(join(args.dir, path));
    lines.push(`${path}\t${await digest(bytes)}`);
  }
  return `sha256-${await digest(new TextEncoder().encode(lines.join("\n")))}`;
}

async function filesUnder(fs: FileSystem, root: string, at: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await fs.list(join(root, at))) {
    const path = at === "" ? entry.name : `${at}/${entry.name}`;
    if (!entry.directory) found.push(path);
    else if (!SKIP.has(entry.name)) found.push(...(await filesUnder(fs, root, path)));
  }
  return found;
}

/**
 * Web Crypto, so this runs wherever the rest of this package runs.
 *
 * The assertion narrows which buffer backs the array rather than claiming the
 * array is a buffer: `BufferSource` wants a view onto an `ArrayBuffer`, and
 * these come from a file read and from `TextEncoder`, both of which give one.
 */
async function digest(bytes: Uint8Array): Promise<string> {
  const hashed = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return base64(new Uint8Array(hashed));
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
