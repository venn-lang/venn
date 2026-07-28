import { type Dirent, readdirSync } from "node:fs";
import { join } from "node:path";
import { type URI, UriUtils } from "langium";
import type { ImportResolver } from "../workspace/index.js";

const EXTENSION = ".vn";
const MAX_DEPTH = 3;
const SKIP = new Set(["node_modules", "dist", ".git"]);

export interface PathArgs {
  partial: string;
  base: URI;
  imports: ImportResolver;
}

/**
 * What may follow `from "`: a `#alias/…` path from `venn.toml`, or a relative
 * path to a sibling `.vn` file. The `#` only marks an alias; plain relative
 * paths need no prefix.
 *
 * @returns Path strings ready to insert, without the surrounding quotes.
 */
export function modulePaths(args: PathArgs): string[] {
  return args.partial.startsWith("#") ? aliasPaths(args) : relativePaths(args.base);
}

function aliasPaths(args: PathArgs): string[] {
  const aliases = Object.entries(args.imports.aliases(args.base));
  const matched = aliases.find(([key]) => args.partial.startsWith(`${key}/`));
  if (!matched) return aliases.map(([key]) => `${key}/`);
  const [key, folder] = matched;
  return sourceFiles(folder).map((file) => `${key}/${file}`);
}

function relativePaths(base: URI): string[] {
  const self = UriUtils.basename(base);
  return sourceFiles(UriUtils.dirname(base))
    .filter((file) => file !== self)
    .map((file) => `./${file}`);
}

function sourceFiles(folder: URI): string[] {
  return walk(folder.fsPath, "", 0);
}

function walk(root: string, relative: string, depth: number): string[] {
  if (depth > MAX_DEPTH) return [];
  const found: string[] = [];
  for (const entry of read(join(root, relative))) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory() && !SKIP.has(entry.name)) found.push(...walk(root, child, depth + 1));
    else if (entry.isFile() && entry.name.endsWith(EXTENSION)) found.push(child);
  }
  return found;
}

function read(directory: string): Dirent[] {
  try {
    return readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}
