import type { FileSystem, Manifest } from "@venn/contracts";
import type { Package } from "../model/project.types.js";
import { reanchor } from "../paths/index.js";
import { inherit } from "../workspace/index.js";
import { conventionalTargets } from "./conventional-targets.js";
import { readManifest } from "./read-manifest.js";

/**
 * One package: its manifest, whatever it inherits, and what it builds.
 *
 * Inheritance is applied here rather than at the point of use, so nothing
 * downstream ever holds a manifest that is only half the answer.
 *
 * @param args.dir The directory holding the `venn.toml`.
 * @returns The package, or `undefined` when that directory has no manifest.
 */
export async function loadPackage(args: {
  fs: FileSystem;
  dir: string;
  /** The workspace this package belongs to, when it belongs to one. */
  workspace?: Manifest;
  /** Where that workspace's manifest lives, which is what its paths mean. */
  workspaceDir?: string;
}): Promise<Package | undefined> {
  const own = await readManifest({ fs: args.fs, dir: args.dir });
  if (!own) return undefined;
  const merged = args.workspace ? inherit({ manifest: own, from: args.workspace }) : own;
  const manifest = anchorPaths({ manifest: merged, own, args });
  const targets = await conventionalTargets({
    fs: args.fs,
    dir: args.dir,
    declared: manifest.targets,
    packageName: manifest.name,
  });
  return { dir: args.dir, manifest, targets };
}

/**
 * Inherited path aliases, rewritten to mean the same place from down here.
 *
 * An alias the member wrote itself is already anchored where it will be read,
 * so only the ones that came from above move. Hence the member's own table is
 * consulted rather than the merged one.
 */
function anchorPaths(input: {
  manifest: Manifest;
  own: Manifest;
  args: { dir: string; workspaceDir?: string };
}): Manifest {
  const root = input.args.workspaceDir;
  if (root === undefined || root === input.args.dir) return input.manifest;
  const paths: Record<string, string> = {};
  for (const [alias, value] of Object.entries(input.manifest.paths)) {
    const mine = input.own.paths[alias] !== undefined;
    paths[alias] = mine
      ? value
      : reanchor({ path: value, declaredIn: root, usedIn: input.args.dir });
  }
  return { ...input.manifest, paths };
}
