import { createNodeFs } from "@venn/contracts/node";
import { ancestors, matchesMember, readManifest, relativeTo } from "@venn/project";

/**
 * Whether a workspace above this path will claim it as a member.
 *
 * Asked before the directory exists, so the member globs are matched as text
 * rather than expanded against the disk. The nearest workspace answers: a root
 * whose `members` do not name this path is not this path's root, and creating a
 * package it will not pick up should not produce a manifest that waits on it.
 */
export async function insideWorkspace(dir: string): Promise<boolean> {
  const fs = createNodeFs();
  for (const above of ancestors(dir).slice(1)) {
    const manifest = await readManifest({ fs, dir: above });
    if (!manifest?.workspace) continue;
    return matchesMember({ path: relativeTo(dir, above), patterns: manifest.workspace.members });
  }
  return false;
}
