import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { HOST_CODES } from "../../errors/host-codes.js";
import { VennError } from "../../errors/index.js";
import { fsNotFound } from "./file-system.errors.js";
import type { DirEntry, FileSystem } from "./file-system.types.js";

/**
 * The real file system, rooted at `root`.
 *
 * @param args.root - where relative paths resolve. Defaults to ".".
 * @returns a {@link FileSystem} that reports a missing path as VN8010 and any
 * other failure as VN8019.
 */
export function createNodeFs(args: { root?: string } = {}): FileSystem {
  const root = args.root ?? ".";
  // A root is where *relative* paths resolve. Joining it onto an absolute path
  // corrupts the path rather than relocating it: `join(".", "C:/x")` is
  // `.\C:\x`, which cannot exist, and the failure surfaces far from here.
  const at = (path: string): string => (isAbsolute(path) ? path : join(root, path));
  return {
    read: (path) => readBytes(at(path)),
    write: (path, bytes) => writeBytes(at(path), bytes),
    exists: (path) => pathExists(at(path)),
    remove: (path) => removePath(at(path)),
    removeAll: (path) => rm(at(path), { recursive: true, force: true }),
    list: (path) => listPath(at(path)),
  };
}

async function listPath(directory: string): Promise<DirEntry[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const found: DirEntry[] = [];
  for (const entry of entries) {
    found.push({ name: entry.name, directory: await holdsMore(directory, entry) });
  }
  return found;
}

type Entry = { name: string; isDirectory(): boolean; isSymbolicLink(): boolean };

/**
 * Whether an entry holds more, following a link if it is one.
 *
 * `readdir` reports a symlink as a symlink and not as what it points at, and
 * whole directory trees are built out of them: pnpm links every installed
 * package into place, so `node_modules/zod` is a link. Trusting the first
 * answer finds no packages at all in a full `node_modules`.
 */
async function holdsMore(directory: string, entry: Entry): Promise<boolean> {
  if (entry.isDirectory()) return true;
  if (!entry.isSymbolicLink()) return false;
  const target = await stat(join(directory, entry.name)).catch(() => undefined);
  return target?.isDirectory() ?? false;
}

async function readBytes(file: string): Promise<Uint8Array> {
  try {
    return new Uint8Array(await readFile(file));
  } catch (err) {
    throw mapMissing(err, file);
  }
}

async function writeBytes(file: string, bytes: Uint8Array): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes);
}

async function pathExists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function removePath(file: string): Promise<void> {
  try {
    await rm(file);
  } catch (err) {
    throw mapMissing(err, file);
  }
}

function mapMissing(err: unknown, file: string): VennError {
  if (isEnoent(err)) return fsNotFound({ path: file });
  const message = err instanceof Error ? err.message : String(err);
  return new VennError({ code: HOST_CODES.VN8019_FILE_SYSTEM, message });
}

function isEnoent(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "ENOENT";
}
