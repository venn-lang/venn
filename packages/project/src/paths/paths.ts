/**
 * Path arithmetic on manifest paths, with no `node:path`.
 *
 * This package runs in a Web Worker as well as in the CLI, so paths are handled
 * as text with forward slashes. A Windows path arrives with backslashes and is
 * normalised on the way in, which is the one place the difference is allowed to
 * exist.
 */

/**
 * One path, written the one way the rest of this package understands.
 *
 * @returns The path with backslashes turned into forward slashes, runs of
 * separators collapsed, and any trailing separator dropped. `"/"` stays `"/"`.
 */
export function normalise(path: string): string {
  const flat = path.replaceAll("\\", "/").replace(/\/+/g, "/");
  return flat.length > 1 ? flat.replace(/\/$/, "") : flat;
}

/**
 * Joins path segments, ignoring empty ones.
 *
 * @returns The joined path, normalised. No `..` is resolved: these are manifest
 * paths, and what a manifest wrote is what gets written down.
 */
export function join(...parts: readonly string[]): string {
  const joined = parts.filter((part) => part !== "").join("/");
  return normalise(joined);
}

/**
 * The directory holding this path.
 *
 * @returns The parent, or `undefined` when there is nothing above. A relative
 * path with one segment has the empty string as its parent, which is the
 * directory it was written against; stopping short of it would leave a walk up
 * from `packages/api` never reaching the workspace root beside it.
 */
export function parentOf(path: string): string | undefined {
  const flat = normalise(path);
  if (flat === "" || flat === "/") return undefined;
  const slash = flat.lastIndexOf("/");
  if (slash < 0) return "";
  return slash === 0 ? "/" : flat.slice(0, slash);
}

/** The last segment of a path, which is the file or directory's own name. */
export function baseName(path: string): string {
  const flat = normalise(path);
  return flat.slice(flat.lastIndexOf("/") + 1);
}

/**
 * Every directory from `path` up to the top, `path` itself first.
 *
 * @returns The chain, ending in `""` for a relative path and `"/"` for an
 * absolute one.
 */
export function ancestors(path: string): string[] {
  const found: string[] = [];
  // Tested against undefined, not for truth: the top of a relative walk is the
  // empty string, which is falsy but is still a directory to look in.
  for (let at: string | undefined = normalise(path); at !== undefined; at = parentOf(at)) {
    found.push(at);
  }
  return found;
}

/** Whether `path` is `base` or sits inside it. */
export function isInside(path: string, base: string): boolean {
  const one = normalise(path);
  const other = normalise(base);
  return one === other || one.startsWith(`${other}/`);
}

/** `path` written relative to `base`, or the path itself when it is not inside. */
export function relativeTo(path: string, base: string): string {
  const one = normalise(path);
  const other = normalise(base);
  return one.startsWith(`${other}/`) ? one.slice(other.length + 1) : one;
}

/**
 * A relative path written in one directory, rewritten to mean the same thing
 * from another inside it.
 *
 * A workspace root writes `"#shared" = "./shared"` once and every member uses
 * it, but a member reads it from further down, where `./shared` is somewhere
 * else entirely.
 *
 * @param args.declaredIn Where the path was written.
 * @param args.usedIn Where it will be read.
 * @returns The path with one `../` per directory of depth. An absolute path is
 * returned unchanged: it already means the same thing everywhere.
 */
export function reanchor(args: { path: string; declaredIn: string; usedIn: string }): string {
  if (!args.path.startsWith(".")) return args.path;
  const down = relativeTo(args.usedIn, args.declaredIn);
  const depth = down === normalise(args.usedIn) ? 0 : down.split("/").filter(Boolean).length;
  if (depth === 0) return args.path;
  return `${"../".repeat(depth)}${args.path.replace(/^\.\//, "")}`;
}
