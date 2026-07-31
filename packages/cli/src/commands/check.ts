import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createNodeHost } from "@venn-lang/contracts/node";
import {
  checkTypes,
  type Document,
  type FragmentDecl,
  importedTypes,
  isPackageSpecifier,
  isValueImport,
  type Problem,
  parse,
} from "@venn-lang/core";
import {
  buildRegistry,
  checkDocument,
  checkImports,
  collectFragments,
  createTypeCatalog,
  publishedValueTypes,
  resolveImports,
} from "@venn-lang/runtime";
import { allPlugins } from "@venn-lang/stdlib";
import type { TypeSpec } from "@venn-lang/types";
import { loadManifest } from "../manifest/index.js";
import { reportProblems } from "../reporters/index.js";
import { everySourceUnder } from "../run/collect-files.js";
import { createNodeModuleIo } from "../run/node-io.js";
import { loadDerivedTypes } from "../run/package-types.js";

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
 * The same walk without the printing, for whoever wants the answer rather than
 * the report: `build` records the count, `check` prints the list.
 */
export async function checkProblems(
  paths: readonly string[],
): Promise<{ files: number; problems: Problem[] }> {
  const files = await everySourceUnder(paths);
  const problems: Problem[] = [];
  for (const file of files) problems.push(...(await problemsIn(file)));
  return { files: files.length, problems };
}

async function problemsIn(uri: string): Promise<Problem[]> {
  const { ast, problems } = parse(await readFile(uri, "utf8"), { uri });
  if (problems.length > 0) return problems;
  const project = await loadManifest(uri);
  const manifest = project?.manifest;
  // Anchored where the manifest lives, not where the file does: a member of a
  // workspace reads the aliases its root declared.
  const io = createNodeModuleIo({
    paths: manifest?.paths ?? {},
    rootDir: project?.dir ?? dirname(uri),
  });
  const { fragments: imported, decos, modules } = await resolveImports({ document: ast, uri, io });
  const registry = buildRegistry({ plugins: allPlugins, caps: createNodeHost().caps });
  const found = checkDocument({
    document: ast,
    registry,
    fragments: names(ast, imported),
    env: declaredEnv(manifest),
    uri,
  });
  const catalog = createTypeCatalog(allPlugins);
  const graph = { modules, resolve: io.resolve };
  // The imported names' types come from the files they were written in, so a
  // wrong argument to an imported function is caught here rather than at run time.
  const imports = importedTypes({
    ...graph,
    document: ast,
    uri,
    catalog,
    packages: await importedFrom({ document: ast, root: project?.dir }),
  });
  return [
    ...found,
    ...checkImports({ document: ast, uri, graph, registry }),
    ...checkTypes(ast, { uri, catalog, decos, imports }).problems,
  ];
}

/**
 * The derived types of the packages this file imports.
 *
 * Read from `target/types/`, where the install wrote them. Absent means nobody
 * has installed anything yet, so every imported name is `dynamic`, which is the
 * truth about it rather than a failure.
 */
async function packageTypesFor(args: {
  document: Document;
  root?: string;
}): Promise<Map<string, Record<string, TypeSpec>>> {
  if (!args.root) return new Map();
  const wanted = args.document.imports
    .filter(isValueImport)
    .map((decl) => decl.path)
    .filter(isPackageSpecifier);
  return wanted.length > 0 ? loadDerivedTypes({ root: args.root, packages: wanted }) : new Map();
}

/**
 * What the imported packages publish: the plugins' own values, and whatever an
 * install derived from a `.d.ts`. The derived ones are listed last, so a package
 * that is both keeps what was read from its types.
 */
async function importedFrom(args: {
  document: Document;
  root?: string;
}): Promise<Map<string, Record<string, TypeSpec>>> {
  const derived = await packageTypesFor(args);
  return new Map([...publishedValueTypes(allPlugins), ...derived]);
}

/**
 * Every variable any `[env.*]` section declares. Undefined without a manifest:
 * with nothing to compare against, every `env.*` read would look undeclared.
 */
function declaredEnv(
  manifest: { env: Record<string, Record<string, string>> } | undefined,
): readonly string[] | undefined {
  const sections = Object.values(manifest?.env ?? {});
  return sections.length > 0 ? [...new Set(sections.flatMap(Object.keys))] : undefined;
}

function names(document: Document, imported: ReadonlyMap<string, FragmentDecl>): Set<string> {
  return new Set([...collectFragments(document).keys(), ...imported.keys()]);
}

function report(problems: Problem[]): number {
  reportProblems(problems);
  return 1;
}

function ok(files: number): number {
  const many = files === 1 ? "" : ` in ${files} files`;
  process.stdout.write(`✓ no problems found${many}\n`);
  return 0;
}
