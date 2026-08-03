import type { FileSystem } from "@venn-lang/contracts";
import { ancestors, matchesMember, readManifest, relativeTo } from "@venn-lang/project";

/**
 * Whether a workspace above this path will claim it as a member.
 *
 * Asked before the directory exists, so the member globs are matched as text
 * rather than expanded against the disk. The nearest workspace answers: a root
 * whose `members` do not name this path is not this path's root, and creating a
 * package it will not pick up should not produce a manifest that waits on it.
 *
 * @param args.fs Where the manifests are read from.
 * @param args.dir Where the new package will go, as an absolute path.
 * @returns Whether a workspace above it names it. Nothing above it means no.
 */
export async function insideWorkspace(args: { fs: FileSystem; dir: string }): Promise<boolean> {
  for (const above of ancestors(args.dir).slice(1)) {
    const manifest = await readManifest({ fs: args.fs, dir: above });
    if (!manifest?.workspace) continue;
    const path = relativeTo(args.dir, above);
    return matchesMember({ path, patterns: manifest.workspace.members });
  }
  return false;
}
