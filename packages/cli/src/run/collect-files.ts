import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const EXTENSION = ".vn";
const SKIP = new Set(["node_modules", "dist", ".git"]);

/**
 * The `.vn` files a path names: the file itself, or every one under a
 * directory, walked recursively and sorted so runs are reproducible.
 */
export async function collectSourceFiles(path: string): Promise<string[]> {
  const info = await stat(path).catch(() => undefined);
  if (!info) return [];
  if (info.isFile()) return path.endsWith(EXTENSION) ? [path] : [];
  return (await walk(path)).sort();
}

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const found: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && !SKIP.has(entry.name))
      found.push(...(await walk(join(directory, entry.name))));
    else if (entry.isFile() && entry.name.endsWith(EXTENSION))
      found.push(join(directory, entry.name));
  }
  return found;
}

/**
 * Every `.vn` under any of these paths, each counted once.
 *
 * Deduplicated because a workspace can name the same directory twice, as a
 * member and as the root that contains it, and checking a file twice reports
 * every problem in it twice.
 */
export async function everySourceUnder(paths: readonly string[]): Promise<string[]> {
  const found = new Set<string>();
  for (const path of paths) {
    for (const file of await collectSourceFiles(resolve(path))) found.add(file);
  }
  return [...found];
}
