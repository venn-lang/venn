/**
 * The part of a path that no host disagrees about: what `.` and `..` mean,
 * where a name ends, and how far two paths walk together.
 */

/**
 * The segments with `.` dropped and `..` walked back.
 *
 * @param rooted Whether these hang off an absolute root. Above one there is
 * nothing, so a `..` that would climb past it is dropped rather than kept:
 * `/../x` is `/x`, because no host has anything above the root. A relative path
 * keeps it, since it still means somewhere the caller can name.
 */
export function normalizeSegments(segments: readonly string[], rooted: boolean): string[] {
  const walked: string[] = [];
  for (const segment of segments) {
    if (segment === ".") continue;
    if (segment !== "..") {
      walked.push(segment);
      continue;
    }
    const last = walked[walked.length - 1];
    if (last !== undefined && last !== "..") walked.pop();
    else if (!rooted) walked.push("..");
  }
  return walked;
}

/**
 * The last dot of a name and what follows it.
 *
 * A leading dot is not one: the whole of `.gitignore` is the file's name, and
 * treating it as an extension would leave the file with no name at all.
 */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot);
}

/** How many leading segments two paths share, by this host's idea of same. */
export function sharedLength(args: {
  left: readonly string[];
  right: readonly string[];
  same: (left: string, right: string) => boolean;
}): number {
  const limit = Math.min(args.left.length, args.right.length);
  let shared = 0;
  while (shared < limit && args.same(args.left[shared] ?? "", args.right[shared] ?? ""))
    shared += 1;
  return shared;
}
