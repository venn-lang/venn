import { normalise } from "../paths/index.js";

/**
 * Whether a path would be caught by a workspace's `members`, without looking at
 * the disk.
 *
 * Needed before the directory exists: creating `packages/api` inside a
 * workspace should produce a manifest that inherits, and expanding the globs
 * cannot answer that yet because there is nothing there to find.
 *
 * @returns `true` when some pattern matches segment for segment, `*` standing
 * for exactly one segment.
 */
export function matchesMember(args: {
  /** The candidate directory, written relative to the workspace root. */
  path: string;
  patterns: readonly string[];
}): boolean {
  const parts = segmentsOf(args.path);
  return args.patterns.some((pattern) => matchesOne(parts, segmentsOf(pattern)));
}

function matchesOne(path: readonly string[], pattern: readonly string[]): boolean {
  if (path.length !== pattern.length) return false;
  return pattern.every((part, index) => part === "*" || part === path[index]);
}

function segmentsOf(path: string): string[] {
  return normalise(path)
    .split("/")
    .filter((part) => part !== "" && part !== ".");
}
