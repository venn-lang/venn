import { type CommandKind, resolveTargets } from "./resolve-targets.js";

/**
 * The paths a command should act on, or nothing, having already written the
 * reason to stderr and set the exit code.
 *
 * Saying why is the point: a bare `venn test` in a folder with no project must
 * not be indistinguishable from one that found nothing to do.
 */
export async function targetsOrExit(args: {
  kind: CommandKind;
  target?: string;
  packageName?: string;
  binName?: string;
}): Promise<readonly string[] | undefined> {
  const found = await resolveTargets({ ...args, cwd: process.cwd() });
  if (found.problem) {
    process.stderr.write(found.problem);
    process.exitCode = 1;
    return undefined;
  }
  return found.paths;
}

/** The worst outcome of running one command over several paths. */
export function worst(codes: readonly number[]): number {
  return codes.reduce((so, far) => Math.max(so, far), 0);
}
