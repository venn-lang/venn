import type { Paths, PathsArgs } from "./paths.types.js";
import { extensionOf, normalizeSegments, sharedLength } from "./segments.js";
import type { Spelling } from "./spelling.types.js";

/**
 * A {@link Paths} that writes the way this spelling says.
 *
 * Every implementation of the port is this function with a different spelling,
 * which is what keeps two hosts from disagreeing about anything but the two
 * things they actually disagree about.
 *
 * @param spelling The separator, the roots, and how names compare.
 * @param args Where relative paths start from. The spelling's own by default.
 * @returns The port implementation.
 */
export function createPaths(spelling: Spelling, args: PathsArgs = {}): Paths {
  const cwd = args.cwd ?? spelling.cwd;
  const join = (parts: readonly string[]): string => joined(spelling, parts);
  const resolve = (parts: readonly string[]): string => join([cwd, ...parts]);
  const split = (path: string): readonly string[] => parted(spelling, path);
  return {
    separator: spelling.separator,
    cwd: () => cwd,
    join,
    resolve,
    split,
    normalize: (path) => join([path]),
    relative: (from, to) => between({ spelling, split, resolve, from, to }),
    dirname: (path) => parent({ spelling, split, join, path }),
    basename: (path) => name(spelling, split(path)),
    extension: (path) => extensionOf(name(spelling, split(path))),
    isAbsolute: (path) => rooted(spelling, path),
  };
}

/**
 * Whether a path starts somewhere fixed rather than wherever the program is.
 *
 * A root carries its own separator, so the one that comes back without one is
 * the one that names a place nobody has said yet.
 */
function rooted(spelling: Spelling, path: string): boolean {
  const root = spelling.write(spelling.rootOf(path));
  return root !== "" && spelling.splitter.test(root[root.length - 1] ?? "");
}

function joined(spelling: Spelling, parts: readonly string[]): string {
  const used = fromLastRoot(spelling, parts.filter(Boolean));
  const root = spelling.write(spelling.rootOf(used[0] ?? ""));
  const walked = normalizeSegments(segmentsOf(spelling, used), rooted(spelling, used[0] ?? ""));
  const body = walked.join(spelling.separator);
  if (root === "") return body === "" ? "." : body;
  return root + body;
}

/**
 * From the last part that starts somewhere of its own.
 *
 * A part with a root is not a continuation of what came before it, it is a
 * different place, and quietly joining the two would name neither.
 */
function fromLastRoot(spelling: Spelling, parts: readonly string[]): readonly string[] {
  for (let index = parts.length - 1; index > 0; index -= 1) {
    if (spelling.rootOf(parts[index] ?? "") !== "") return parts.slice(index);
  }
  return parts;
}

/** Every part of every piece, roots and separators gone. */
function segmentsOf(spelling: Spelling, parts: readonly string[]): string[] {
  const first = parts[0] ?? "";
  const headless = [first.slice(spelling.rootOf(first).length), ...parts.slice(1)];
  return headless.flatMap((part) => part.split(spelling.splitter)).filter(Boolean);
}

/** The root, when there is one, then the names: what `join` reads back whole. */
function parted(spelling: Spelling, path: string): readonly string[] {
  const root = spelling.rootOf(path);
  const names = path.slice(root.length).split(spelling.splitter).filter(Boolean);
  return root === "" ? names : [spelling.write(root), ...names];
}

interface Walk {
  spelling: Spelling;
  split: (path: string) => readonly string[];
  resolve: (parts: readonly string[]) => string;
  from: string;
  to: string;
}

/**
 * The way from one path to the other.
 *
 * Both are resolved first, so a relative and an absolute path can still be
 * compared: each means somewhere, and this is the walk between them.
 */
function between(walk: Walk): string {
  const { spelling } = walk;
  const target = walk.resolve([walk.to]);
  const [here, there] = [walk.split(walk.resolve([walk.from])), walk.split(target)];
  // Two roots with nothing above them: no walk joins a network share to a local
  // drive, so the honest answer is the place itself rather than a path of `..`.
  if (!spelling.same(here[0] ?? "", there[0] ?? "")) return target;
  const shared = sharedLength({ left: here, right: there, same: spelling.same });
  const up = here.slice(shared).map(() => "..");
  return [...up, ...there.slice(shared)].join(spelling.separator);
}

interface Parent {
  spelling: Spelling;
  split: (path: string) => readonly string[];
  join: (parts: readonly string[]) => string;
  path: string;
}

function parent(args: Parent): string {
  const parts = args.split(args.path);
  const root = args.spelling.rootOf(parts[0] ?? "") === "" ? "" : (parts[0] ?? "");
  const names = root === "" ? parts : parts.slice(1);
  if (names.length <= 1) return root === "" ? "." : root;
  return args.join([root, ...names.slice(0, -1)]);
}

/** The last part, unless the only part is the root, which nothing is named. */
function name(spelling: Spelling, parts: readonly string[]): string {
  const last = parts[parts.length - 1] ?? "";
  return spelling.rootOf(last) === "" ? last : "";
}
