import { binTarget, sourcePaths, testPaths } from "./command-targets.js";
import { selectPackages, unknownPackage } from "./select-packages.js";

/** What a command was pointed at, once the project has had its say. */
export interface ResolvedTargets {
  paths: readonly string[];
  /** What to print and stop for, when the request cannot be answered. */
  problem?: string;
}

export type CommandKind = "test" | "check" | "run";

/**
 * The paths a command acts on: the one it was given, or the ones the project
 * says it means.
 *
 * An explicit path always wins and is never second-guessed: `venn test
 * examples/` tests `examples/`, project or no project. Everything else is the
 * workspace answering the question the bare command asked.
 */
export async function resolveTargets(args: {
  kind: CommandKind;
  target?: string;
  packageName?: string;
  binName?: string;
  cwd: string;
}): Promise<ResolvedTargets> {
  if (args.target) return { paths: [args.target] };
  const selection = await selectPackages({ from: args.cwd, packageName: args.packageName });
  if (!selection) return { paths: [], problem: NO_PROJECT };
  if (args.packageName && selection.packages.length === 0) {
    return { paths: [], problem: unknownPackage(selection.project, args.packageName) };
  }
  return forKind({ ...args, selection });
}

const NO_PROJECT =
  "VN2101 · no venn.toml here, or in any folder above it.\n" +
  "  give a path, or start a project with `venn init`\n";

async function forKind(args: {
  kind: CommandKind;
  binName?: string;
  selection: Awaited<ReturnType<typeof selectPackages>>;
}): Promise<ResolvedTargets> {
  const packages = args.selection?.packages ?? [];
  if (args.kind === "check") return { paths: sourcePaths(packages) };
  if (args.kind === "test") return testTargets(await testPaths(packages));
  return runTarget(packages, args.binName);
}

function testTargets(paths: readonly string[]): ResolvedTargets {
  if (paths.length > 0) return { paths };
  return { paths: [], problem: "no `tests/` directory in the packages selected.\n" };
}

function runTarget(
  packages: Parameters<typeof binTarget>[0]["packages"],
  name?: string,
): ResolvedTargets {
  const found = binTarget({ packages, name });
  if (!found) return { paths: [], problem: "no program to run here — expected `src/main.vn`.\n" };
  if ("ambiguous" in found) {
    return {
      paths: [],
      problem: `several programs here. Pick one: --bin ${found.ambiguous.join(" | --bin ")}\n`,
    };
  }
  return { paths: [found.path] };
}
