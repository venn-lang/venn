import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createNodeHost } from "@venn-lang/contracts/node";
import { type Document, type Problem, parse } from "@venn-lang/core";
import {
  type AnalyzeArgs,
  collectFragments,
  createFrontEnd,
  type FrontEnd,
  type ModuleIo,
  resolveImports,
} from "@venn-lang/runtime";
import { allPlugins } from "@venn-lang/stdlib";
import { declaredEnv, type LoadedManifest, loadManifest } from "../manifest/index.js";
import { reportProblems } from "../reporters/index.js";
import { everySourceUnder } from "../run/collect-files.js";
import { createNodeModuleIo } from "../run/node-io.js";
import { packageTypesFor } from "../run/package-types.js";

/**
 * `venn check <file|folder>`: statically resolve actions, matchers, imports and
 * types without running. A folder is walked.
 *
 * @returns 0 when nothing was found, 1 when problems were reported or the paths
 * hold no `.vn` file.
 */
export async function checkCommand(args: { paths: readonly string[] }): Promise<number> {
  const files = await everySourceUnder(args.paths);
  if (files.length === 0) {
    process.stderr.write(`No .vn files found at ${args.paths.join(", ")}\n`);
    return 1;
  }
  // Gathered across every file and reported once: a project that checks clean
  // should say so once, not once per file.
  const found = await checkProblems(args.paths);
  return found.problems.length > 0 ? report(found.problems) : ok(files.length);
}

/**
 * Whether a problem is one that fails the check.
 *
 * A hint is something worth saying and not something worth stopping for: an
 * import nobody used is untidy, not wrong, and a check that fails on it is a
 * check people stop running. `venn build` reads the same rule, so a file that
 * checks clean does not fail the release path over an untidy import.
 */
export function isError(problem: Problem): boolean {
  return problem.severity === "error";
}

/**
 * The same walk without the printing, for whoever wants the answer rather than
 * the report: `build` records the count, `check` prints the list.
 */
export async function checkProblems(
  paths: readonly string[],
): Promise<{ files: number; problems: Problem[] }> {
  const files = await everySourceUnder(paths);
  // Built once for the whole walk: the registry, the decorators and the type
  // catalog are the same answer for every file, and were rebuilt for each.
  const front = createFrontEnd({ plugins: allPlugins, caps: createNodeHost().caps });
  const problems: Problem[] = [];
  for (const file of files) problems.push(...(await problemsIn(file, front)));
  return { files: files.length, problems: said(problems) };
}

/**
 * Each problem once.
 *
 * A cycle is found from every file that leads into it, and it is one mistake
 * however many found it. Two files reaching the same one produce the same
 * problem, down to the span, so sameness is the whole test.
 */
function said(problems: readonly Problem[]): Problem[] {
  const seen = new Set<string>();
  return problems.filter((problem) => {
    const key = `${problem.code}:${problem.span.uri}:${problem.span.offset}:${problem.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function problemsIn(uri: string, front: FrontEnd): Promise<Problem[]> {
  const { ast, problems } = parse(await readFile(uri, "utf8"), { uri });
  if (problems.length > 0) return problems;
  return [...front.analyze(await inputsFor(ast, uri)).problems];
}

/** What the project this file belongs to says about the world around it. */
async function inputsFor(document: Document, uri: string): Promise<AnalyzeArgs> {
  const project = await loadManifest(uri);
  const io = moduleIo(project, uri);
  const found = await resolveImports({ document, uri, io });
  return {
    document,
    uri,
    graph: { modules: found.modules, resolve: io.resolve },
    decos: found.decos,
    fragments: names(document, found.fragments),
    env: await declaredEnv(project),
    packages: await packageTypesFor({ document, root: project?.dir }),
    unreadable: found.unreadable,
    cycles: found.cycles,
  };
}

/**
 * Anchored where the manifest lives, not where the file does: a member of a
 * workspace reads the aliases its root declared.
 */
function moduleIo(project: LoadedManifest | undefined, uri: string): ModuleIo {
  return createNodeModuleIo({
    paths: project?.manifest.paths ?? {},
    rootDir: project?.dir ?? dirname(uri),
  });
}

/**
 * The derived types of the packages this file imports.
 *
 * Read from `target/types/`, where the install wrote them. Absent means nobody
 * has installed anything yet, so every imported name is `dynamic`, which is the
 * truth about it rather than a failure.
 */

function names(document: Document, imported: ReadonlyMap<string, unknown>): Set<string> {
  return new Set([...collectFragments(document).keys(), ...imported.keys()]);
}

function report(problems: Problem[]): number {
  reportProblems(problems);
  return problems.some(isError) ? 1 : 0;
}

function ok(files: number): number {
  const many = files === 1 ? "" : ` in ${files} files`;
  process.stdout.write(`✓ no problems found${many}\n`);
  return 0;
}
