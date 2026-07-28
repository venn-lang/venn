import type { FileSystem } from "@venn/contracts";
import { join } from "../paths/index.js";

/**
 * Expands a workspace's `members` patterns against the disk.
 *
 * `*` stands for one path segment, the way Cargo reads it, so `packages/*` is
 * every package one level down and nothing deeper. `**` is deliberately not
 * read: a member list that can reach arbitrarily far is one nobody can predict.
 *
 * @param args.root The workspace root the patterns are written against.
 * @returns The directories matched, duplicates dropped, in pattern order with
 * names sorted inside each pattern, so two machines list a workspace alike.
 */
export async function expandMembers(args: {
  fs: FileSystem;
  root: string;
  patterns: readonly string[];
}): Promise<string[]> {
  const found: string[] = [];
  for (const pattern of args.patterns) {
    for (const dir of await expandOne(args.fs, args.root, pattern)) {
      if (!found.includes(dir)) found.push(dir);
    }
  }
  return found;
}

async function expandOne(fs: FileSystem, root: string, pattern: string): Promise<string[]> {
  let at = [root];
  for (const segment of pattern.split("/").filter((part) => part !== "")) {
    at = segment === "*" ? await childrenOf(fs, at) : at.map((dir) => join(dir, segment));
  }
  return at;
}

async function childrenOf(fs: FileSystem, dirs: readonly string[]): Promise<string[]> {
  const found: string[] = [];
  for (const dir of dirs) {
    const entries = await fs.list(dir);
    const names = entries.filter((entry) => entry.directory).map((entry) => entry.name);
    for (const name of names.sort()) found.push(join(dir, name));
  }
  return found;
}
