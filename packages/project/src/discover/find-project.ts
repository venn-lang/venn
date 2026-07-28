import type { FileSystem, Manifest } from "@venn-lang/contracts";
import type { FoundProject, Package } from "../model/project.types.js";
import { ancestors, join, normalise } from "../paths/index.js";
import { memberDirs } from "../workspace/index.js";
import { loadPackage } from "./load-package.js";
import { readManifest } from "./read-manifest.js";

/**
 * The project a path belongs to: the nearest package, and the root that owns it.
 *
 * Walking up is what lets a command run from anywhere inside a project, the way
 * `cargo` and `git` do. A package is claimed by an ancestor workspace only when
 * that workspace's members name it, so a project checked out inside another
 * never joins it by accident.
 *
 * @param args.fs Where the manifests are read from.
 * @param args.from Any path inside the project; the walk starts here.
 * @returns The project with its members loaded and inheritance applied, or one
 * `VN2101` problem when no `venn.toml` sits here or above. Reading a project
 * never throws: a failure comes back as a problem.
 */
export async function findProject(args: { fs: FileSystem; from: string }): Promise<FoundProject> {
  const nearest = await nearestManifest(args.fs, args.from);
  if (!nearest) return { problems: [noManifest(args.from)] };
  if (nearest.manifest.workspace) return workspaceAt(args.fs, nearest.dir, nearest.manifest);
  const owner = await owningWorkspace(args.fs, nearest.dir);
  return owner
    ? workspaceAt(args.fs, owner.dir, owner.manifest)
    : lonePackage(args.fs, nearest.dir);
}

interface Found {
  dir: string;
  manifest: Manifest;
}

async function nearestManifest(fs: FileSystem, from: string): Promise<Found | undefined> {
  for (const dir of ancestors(from)) {
    const manifest = await readManifest({ fs, dir });
    if (manifest) return { dir, manifest };
  }
  return undefined;
}

/** The nearest workspace above this package that lists it among its members. */
async function owningWorkspace(fs: FileSystem, dir: string): Promise<Found | undefined> {
  for (const above of ancestors(dir).slice(1)) {
    const manifest = await readManifest({ fs, dir: above });
    if (!manifest?.workspace) continue;
    const members = await memberDirs({ fs, root: above, workspace: manifest.workspace });
    if (members.includes(normalise(dir))) return { dir: above, manifest };
  }
  return undefined;
}

async function lonePackage(fs: FileSystem, dir: string): Promise<FoundProject> {
  const found = await loadPackage({ fs, dir });
  if (!found) return { problems: [noManifest(dir)] };
  return {
    project: {
      root: dir,
      isWorkspace: false,
      rootManifest: found.manifest,
      packages: [found],
      defaultPackages: [found],
    },
    problems: [],
  };
}

async function workspaceAt(
  fs: FileSystem,
  root: string,
  manifest: Manifest,
): Promise<FoundProject> {
  const settings = manifest.workspace;
  if (!settings) return lonePackage(fs, root);
  const dirs = await memberDirs({ fs, root, workspace: settings });
  const packages = await loadEach({ fs, dirs, workspace: manifest, workspaceDir: root });
  const rootPackage = manifest.name === "" ? undefined : await loadPackage({ fs, dir: root });
  const all = rootPackage ? [rootPackage, ...packages] : packages;
  return {
    project: {
      root,
      isWorkspace: true,
      rootManifest: manifest,
      packages: all,
      defaultPackages: defaults(all, settings.defaultMembers, root),
    },
    problems: [],
  };
}

async function loadEach(args: {
  fs: FileSystem;
  dirs: readonly string[];
  workspace: Manifest;
  workspaceDir: string;
}): Promise<Package[]> {
  const found: Package[] = [];
  for (const dir of args.dirs) {
    const one = await loadPackage({
      fs: args.fs,
      dir,
      workspace: args.workspace,
      workspaceDir: args.workspaceDir,
    });
    if (one) found.push(one);
  }
  return found;
}

/** `default-members`, or every member when the root did not narrow it. */
function defaults(all: readonly Package[], names: readonly string[], root: string): Package[] {
  if (names.length === 0) return [...all];
  const wanted = new Set(names.map((name) => join(root, name)));
  return all.filter((one) => wanted.has(one.dir) || wanted.has(one.manifest.name));
}

function noManifest(path: string): { code: string; title: string; path: string } {
  return {
    code: "VN2101",
    title: "No venn.toml here, or in any folder above it.",
    path: normalise(path),
  };
}
