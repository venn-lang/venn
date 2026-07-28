import { dirname, resolve } from "node:path";
import type { Manifest } from "@venn/contracts";
import { createNodeFs } from "@venn/contracts/node";
import { findProject, isInside, normalise, type Package, type Project } from "@venn/project";

export interface LoadedManifest {
  manifest: Manifest;
  /**
   * The directory the settings are anchored to.
   *
   * Carried because a `[paths]` alias is written relative to the project, not
   * to the folder the `.vn` file happens to sit in: a member of a workspace
   * reads the aliases its root declared.
   */
  dir: string;
}

/**
 * The manifest that governs a `.vn` file.
 *
 * Found by walking up to the project the file belongs to, rather than by
 * reading whatever happens to sit in the same folder. That is what makes a
 * command work from anywhere: `venn test packages/api/src/login.vn` sees the
 * same environments and aliases as running it from inside `packages/api`.
 *
 * Undefined when nothing governs the file: living outside a project is normal.
 */
export async function loadManifest(sourceUri: string): Promise<LoadedManifest | undefined> {
  const file = normalise(resolve(sourceUri));
  const { project } = await findProject({ fs: createNodeFs(), from: normalise(dirname(file)) });
  if (!project) return undefined;
  const owner = owningPackage(project, file);
  if (owner) return { manifest: owner.manifest, dir: owner.dir };
  return { manifest: project.rootManifest, dir: project.root };
}

/** The innermost member holding this file: the one whose settings are nearest. */
function owningPackage(project: Project, file: string): Package | undefined {
  return [...project.packages]
    .filter((one) => isInside(file, one.dir))
    .sort((a, b) => b.dir.length - a.dir.length)[0];
}
