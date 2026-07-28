import type { FileSystem } from "@venn/contracts";
import { join } from "../paths/index.js";
import { LOCK_FILE, LOCK_VERSION, type Lockfile } from "./lockfile.types.js";
import { readInstalled } from "./read-installed.js";

/**
 * Writes `venn.lock` from what is installed.
 *
 * It goes at the project root, beside the manifest, and is meant to be
 * committed. The manager's own lock stays inside `target/`, which is derived
 * and thrown away.
 *
 * @param args.manager Which tool did the resolving, recorded in the file.
 * @returns The lock as written.
 * @throws Whatever the file system raises when the write fails.
 */
export async function writeLockfile(args: {
  fs: FileSystem;
  root: string;
  manager: string;
}): Promise<Lockfile> {
  const lock: Lockfile = {
    version: LOCK_VERSION,
    manager: args.manager,
    packages: await readInstalled({ fs: args.fs, root: args.root }),
  };
  const text = `${JSON.stringify(lock, null, 2)}\n`;
  await args.fs.write(join(args.root, LOCK_FILE), new TextEncoder().encode(text));
  return lock;
}

/**
 * Reads the lock this project committed.
 *
 * @returns The lock, or `undefined` when the file is absent or will not parse.
 * A lock nobody can read is a project without one, which `install` can fix.
 */
export async function readLockfile(args: {
  fs: FileSystem;
  root: string;
}): Promise<Lockfile | undefined> {
  const bytes = await args.fs.read(join(args.root, LOCK_FILE)).catch(() => undefined);
  if (!bytes) return undefined;
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as Lockfile;
  } catch {
    return undefined;
  }
}
