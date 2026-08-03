import type { FileSystem, Manifest } from "@venn-lang/contracts";
import type { Package } from "../model/project.types.js";
import { asMember } from "../workspace/index.js";
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
  const manifest = args.workspace
    ? asMember({
        manifest: own,
        dir: args.dir,
        from: args.workspace,
        fromDir: args.workspaceDir ?? args.dir,
      })
    : own;
  const targets = await conventionalTargets({
    fs: args.fs,
    dir: args.dir,
    declared: manifest.targets,
    packageName: manifest.name,
  });
  return { dir: args.dir, manifest, targets };
}
