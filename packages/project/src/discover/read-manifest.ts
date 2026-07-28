import { createTomlManifest, type FileSystem, type Manifest } from "@venn-lang/contracts";
import { join } from "../paths/index.js";

/** The file that makes a directory a package or a workspace root. */
export const MANIFEST_FILE = "venn.toml";

/**
 * Reads and parses the `venn.toml` in one directory.
 *
 * @returns The manifest, or `undefined` when the file is absent or unreadable.
 * A directory that cannot be read is a directory without a manifest, so the
 * caller keeps walking instead of failing.
 */
export async function readManifest(args: {
  fs: FileSystem;
  dir: string;
}): Promise<Manifest | undefined> {
  const path = join(args.dir, MANIFEST_FILE);
  if (!(await args.fs.exists(path))) return undefined;
  const bytes = await args.fs.read(path).catch(() => undefined);
  if (!bytes) return undefined;
  return createTomlManifest({ content: new TextDecoder().decode(bytes) }).load();
}
