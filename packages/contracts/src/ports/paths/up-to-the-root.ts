/**
 * The one upward walk: a directory and every directory above it, nearest first.
 *
 * Written as text, with no `node:path`, because the editor walks the same
 * directories in a Web Worker that the CLI walks on a disk. Three packages had
 * a copy of this and the three disagreed about where a Windows path stops, so
 * an absolute walk fell off the drive root into the empty string and every
 * caller below it read out of whatever directory the shell was standing in.
 *
 * The rule that fixes it is one line: an absolute walk never yields a relative
 * step. `""` is still the top of a relative walk, because that is what a
 * relative path is written against, and a filesystem whose root is spelled `""`
 * has nowhere else to end.
 */

/** `c:` or `c:/`, the two ways a Windows drive root gets written. */
const DRIVE_ROOT = /^[a-zA-Z]:\/?$/;

/**
 * One path, written the one way this walk understands.
 *
 * @param path Any path, in either spelling.
 * @returns The path with backslashes turned into forward slashes, runs of
 * separators collapsed, and any trailing separator dropped. A root keeps its
 * slash: `"/"` stays `"/"` and `"c:"` becomes `"c:/"`, so the two roots are
 * spelled one way each and a walk can tell it has arrived.
 */
export function normalisePath(path: string): string {
  const flat = path.replaceAll("\\", "/").replace(/\/+/g, "/");
  const trimmed = flat.length > 1 && flat.endsWith("/") ? flat.slice(0, -1) : flat;
  return DRIVE_ROOT.test(trimmed) ? `${trimmed.slice(0, 2)}/` : trimmed;
}

/** Whether a normalised path is the top of its own walk. */
function isRoot(flat: string): boolean {
  return flat === "" || flat === "/" || DRIVE_ROOT.test(flat);
}

/**
 * The directory holding this path.
 *
 * @param path Any path, in either spelling.
 * @returns The parent, or `undefined` at the top. `"/a"` gives `"/"` and
 * `"c:/a"` gives `"c:/"`, both of which are the top; a relative path with one
 * segment gives `""`, the directory it was written against, because stopping
 * short of it would leave a walk up from `packages/api` never reaching the
 * workspace root beside it.
 */
export function parentDirOf(path: string): string | undefined {
  const flat = normalisePath(path);
  if (isRoot(flat)) return undefined;
  const slash = flat.lastIndexOf("/");
  if (slash < 0) return "";
  return normalisePath(flat.slice(0, slash + 1));
}

/**
 * Every directory from `path` up to the top, `path` itself first.
 *
 * @param path Where to start, as a plain path.
 * @returns The chain, ending at `"/"` for a unix path, `"c:/"` for a Windows
 * one and `""` for a relative one. An absolute walk holds no relative step, so
 * no caller of it can be handed a path that resolves against a working
 * directory nobody named.
 */
export function ancestorsOf(path: string): string[] {
  const found: string[] = [];
  // Tested against undefined, not for truth: the top of a relative walk is the
  // empty string, which is falsy but is still a directory to look in.
  for (let at: string | undefined = normalisePath(path); at !== undefined; at = parentDirOf(at)) {
    found.push(at);
  }
  return found;
}
