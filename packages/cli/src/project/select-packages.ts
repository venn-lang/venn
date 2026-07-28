import { createNodeFs } from "@venn/contracts/node";
import { findProject, normalise, type Package, type Project } from "@venn/project";

export interface Selection {
  project: Project;
  /** The packages this command acts on. */
  packages: readonly Package[];
}

export interface SelectArgs {
  /** Where the command was run, or the path it was given. */
  from: string;
  /** `-p api`: one member by name. Absent means the workspace's default set. */
  packageName?: string;
}

/**
 * Which packages a command with no file argument acts on.
 *
 * A workspace answers with its `default-members`, or with all of them when it
 * named none. That is the rule Cargo follows, and the reason `venn test` at the
 * root of a monorepo means "the suite", not "nothing here".
 */
export async function selectPackages(args: SelectArgs): Promise<Selection | undefined> {
  const { project } = await findProject({ fs: createNodeFs(), from: normalise(args.from) });
  if (!project) return undefined;
  if (!args.packageName) return { project, packages: project.defaultPackages };
  const wanted = project.packages.filter((one) => one.manifest.name === args.packageName);
  return { project, packages: wanted };
}

/** What to say when `-p` named something the workspace does not hold. */
export function unknownPackage(project: Project, name: string): string {
  const known = project.packages.map((one) => one.manifest.name).filter(Boolean);
  const list = known.length > 0 ? known.join(", ") : "none";
  return `VN2103 · no package named ${name} in this workspace.\n  it holds: ${list}\n`;
}
