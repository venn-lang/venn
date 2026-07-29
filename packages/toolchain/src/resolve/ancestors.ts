/**
 * A directory and every directory above it, nearest first.
 *
 * A subdirectory of a project is part of that project, so running a command
 * from `tests/api` has to find the `venn.toml` at the root. Walking stops at
 * the filesystem root rather than at the home directory: a project can sit
 * anywhere, including outside it.
 *
 * @param directory Where to start, as a plain path.
 * @returns Every directory from that one upwards, ending with the root.
 */
export function ancestors(directory: string): string[] {
  const path = normalise(directory);
  if (path === "") return [];
  const found: string[] = [];
  let at = path;
  while (true) {
    found.push(at);
    const parent = parentOf(at);
    if (parent === at) return found;
    at = parent;
  }
}

/** Backslashes to slashes, and no trailing one, so paths compare as text. */
function normalise(path: string): string {
  const forward = path.split("\\").join("/");
  return forward.length > 1 ? forward.replace(/\/+$/, "") : forward;
}

/**
 * `c:/a/b` gives `c:/a`, and `c:/a` gives `c:/`, which is its own parent and
 * so ends the walk. On unix `/a` gives `/`, the same way.
 */
function parentOf(path: string): string {
  const at = path.lastIndexOf("/");
  if (at === -1) return path;
  if (at === 0) return "/";
  const parent = path.slice(0, at);
  return parent.endsWith(":") ? `${parent}/` : parent;
}
