import type { FileSystem, WorkspaceSettings } from "@venn-lang/contracts";
import { expandMembers } from "../glob/index.js";
import { isInside, join, normalise } from "../paths/index.js";

/**
 * The directories a workspace's members occupy, exclusions already applied.
 *
 * @returns The member directories, normalised. One holding no `venn.toml` is
 * dropped rather than reported: a glob describes a shape, and `packages/*`
 * catching a `dist` folder on the way past is the glob working, not the
 * workspace being wrong.
 */
export async function memberDirs(args: {
  fs: FileSystem;
  root: string;
  workspace: WorkspaceSettings;
}): Promise<string[]> {
  const matched = await expandMembers({
    fs: args.fs,
    root: args.root,
    patterns: args.workspace.members,
  });
  const excluded = args.workspace.exclude.map((path) => normalise(join(args.root, path)));
  const kept = matched.filter((dir) => !excluded.some((one) => isInside(dir, one)));
  return withManifest(args.fs, kept);
}

async function withManifest(fs: FileSystem, dirs: readonly string[]): Promise<string[]> {
  const found: string[] = [];
  for (const dir of dirs) {
    if (await fs.exists(join(dir, "venn.toml"))) found.push(normalise(dir));
  }
  return found;
}
