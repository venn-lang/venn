import { type Dirent, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "@venn-lang/core";
import { type URI, UriUtils } from "langium";
import { exportedNames } from "../document/index.js";
import type { ImportResolver } from "../workspace/index.js";

const EXTENSION = ".vn";
const MAX_DEPTH = 4;
const SKIP = new Set(["node_modules", "dist", ".git"]);

/** A module that exports the wanted name, and how to write its specifier. */
export interface ExportingModule {
  specifier: string;
  file: string;
}

/**
 * Every `.vn` file near this one that marks `name` as `pub`. Specifiers prefer
 * a configured `#alias`, falling back to a relative path.
 */
export function modulesExporting(args: {
  name: string;
  base: URI;
  imports: ImportResolver;
}): ExportingModule[] {
  const aliases = args.imports.aliases(args.base);
  const root = UriUtils.dirname(args.base);
  const found: ExportingModule[] = [];
  for (const file of walk(root.fsPath, "", 0)) {
    if (!exportsName(join(root.fsPath, file), args.name)) continue;
    found.push({ specifier: specifierFor(file, root, aliases), file });
  }
  return found;
}

function exportsName(path: string, name: string): boolean {
  try {
    const { ast, problems } = parse(readFileSync(path, "utf8"), { uri: path });
    return problems.length === 0 && exportedNames(ast).some((each) => each.name === name);
  } catch {
    return false;
  }
}

// `#shared/auth.vn` reads better than `./shared/auth.vn` when an alias covers it.
function specifierFor(file: string, root: URI, aliases: Record<string, URI>): string {
  const absolute = UriUtils.resolvePath(root, file).toString();
  for (const [alias, folder] of Object.entries(aliases)) {
    const prefix = `${folder.toString()}/`;
    if (absolute.startsWith(prefix)) return `${alias}/${absolute.slice(prefix.length)}`;
  }
  return `./${file}`;
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
