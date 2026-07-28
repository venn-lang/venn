import { createNodeFs } from "@venn/contracts/node";
import { type BuildTarget, join, type Package } from "@venn/project";

const TESTS_DIR = "tests";

/**
 * Where a package's test suite lives.
 *
 * `tests/` and nothing else. Running everything in the package instead would
 * sweep up `src/main.vn`, a program rather than a suite, and report a run
 * nobody asked for. A package with no `tests/` contributes nothing, which is
 * the truth about it rather than a failure.
 */
export async function testPaths(packages: readonly Package[]): Promise<string[]> {
  const fs = createNodeFs();
  const found: string[] = [];
  for (const one of packages) {
    const dir = join(one.dir, TESTS_DIR);
    if (await fs.exists(dir)) found.push(dir);
  }
  return found;
}

/** Every `.vn` a package owns: what `check` and `fmt` act on. */
export function sourcePaths(packages: readonly Package[]): string[] {
  return packages.map((one) => one.dir);
}

/**
 * The program `venn run` means when it is given no file.
 *
 * One `bin` is unambiguous. Several is a question only the author can answer,
 * so it is asked rather than guessed: picking the first would be a coin toss
 * that looks like a decision.
 */
export function binTarget(args: {
  packages: readonly Package[];
  name?: string;
}): { path: string } | { ambiguous: readonly string[] } | undefined {
  const bins = args.packages.flatMap((one) =>
    one.targets.filter(isBin).map((target) => ({ target, dir: one.dir })),
  );
  const wanted = args.name ? bins.filter((one) => one.target.name === args.name) : bins;
  if (wanted.length === 1 && wanted[0]) {
    return { path: join(wanted[0].dir, wanted[0].target.path) };
  }
  if (wanted.length === 0) return undefined;
  return { ambiguous: wanted.map((one) => one.target.name) };
}

function isBin(target: BuildTarget): boolean {
  return target.kind === "bin";
}
