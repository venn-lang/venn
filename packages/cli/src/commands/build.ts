import { createNodeFs } from "@venn/contracts/node";
import {
  type BuiltTarget,
  join,
  type Package,
  type ProfileName,
  type Project,
  relativeTo,
  writeBuildRecord,
} from "@venn/project";
import { selectPackages, unknownPackage } from "../project/index.js";
import { reportProblems } from "../reporters/index.js";
import { checkProblems } from "./check.js";

export interface BuildArgs {
  release?: boolean;
  packageName?: string;
}

/**
 * `venn build`: check every target of the selected packages, and record it.
 *
 * What lands in `target/<profile>/` is a record of what the project builds and
 * whether it held together, not generated code.
 *
 * A build with problems fails either way. `strict` decides whether the record
 * is written anyway: under `dev` it is, so the editor and the next build can see
 * a half-written project. Under `release` nothing is written over a problem.
 *
 * @returns 0 when the build is clean, 1 when problems were found or no
 * `venn.toml` governs the working directory.
 */
export async function buildCommand(args: BuildArgs): Promise<number> {
  const selection = await selectPackages({ from: process.cwd(), packageName: args.packageName });
  if (!selection) {
    process.stderr.write("VN2101 · no venn.toml here, or in any folder above it.\n");
    return 1;
  }
  if (args.packageName && selection.packages.length === 0) {
    process.stderr.write(unknownPackage(selection.project, args.packageName));
    return 1;
  }
  const profile: ProfileName = args.release ? "release" : "debug";
  return build({ project: selection.project, packages: selection.packages, profile });
}

async function build(args: {
  project: Project;
  packages: readonly Package[];
  profile: ProfileName;
}): Promise<number> {
  const found = await checkProblems(args.packages.map((one) => one.dir));
  if (found.problems.length > 0) reportProblems([...found.problems]);
  if (found.problems.length > 0 && isStrict(args.project, args.profile)) return 1;
  const path = await writeBuildRecord({
    fs: createNodeFs(),
    root: args.project.root,
    record: {
      profile: args.profile,
      targets: builtTargets(args.packages, args.project.root),
      files: found.files,
      problems: found.problems.length,
    },
  });
  return announce({ ...args, files: found.files, problems: found.problems.length, path });
}

function builtTargets(packages: readonly Package[], root: string): BuiltTarget[] {
  return packages.flatMap((one) =>
    one.targets.map((target) => ({
      package: one.manifest.name,
      kind: target.kind,
      name: target.name,
      path: relativeTo(join(one.dir, target.path), root),
    })),
  );
}

/** `target/debug` is written by the `dev` profile, the way Cargo names them. */
function isStrict(project: Project, profile: ProfileName): boolean {
  const key = profile === "debug" ? "dev" : "release";
  return project.rootManifest.profiles[key]?.strict === true;
}

function announce(args: {
  packages: readonly Package[];
  profile: ProfileName;
  files: number;
  problems: number;
  path: string;
}): number {
  const targets = args.packages.reduce((so, one) => so + one.targets.length, 0);
  process.stdout.write(
    `${args.profile}: ${targets} target(s), ${args.files} file(s) → ${args.path}\n`,
  );
  return args.problems > 0 ? 1 : 0;
}
