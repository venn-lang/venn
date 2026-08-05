import {
  buildProblem,
  CODES,
  type Document,
  isDecoDecl,
  isFnDecl,
  isFragmentDecl,
  isLetStmt,
  isPackageSpecifier,
  isTypeDecl,
  isValueImport,
  type Problem,
  publishedNames,
  type RelatedInfo,
  type ValueImport,
} from "@venn-lang/core";
import { readImports } from "../imports/index.js";
import type { Registry } from "../registry/index.js";
import type { ImportCycle, UnreadableImport } from "../run/index.js";
import type { ImportGraph } from "../scheduler/index.js";
import { nodeSpan } from "../scheduler/index.js";
import { checkPackageImport } from "./check-package-import.js";

/**
 * Check every name a file imports against what the file it names publishes.
 * Otherwise a misspelt import stays quietly `undefined` until something calls
 * it, and the run blames the call site rather than the import.
 *
 * @param args The importing document, its URI, the resolved import graph, and
 * the imports whose path answered nothing.
 * @returns One `VN2009` per name the target does not publish, and one `VN2019`
 * per path that led nowhere.
 */
export function checkImports(args: {
  document: Document;
  uri: string;
  graph: ImportGraph;
  /**
   * What the loaded plugins publish, for the names asked of a package.
   *
   * Required, and not because every caller has one to spare. It was optional,
   * the editor's validator quietly did not pass it, and the one diagnostic
   * whose note tells you the fix never reached the one surface where it would
   * be read.
   */
  registry: Registry;
  /**
   * Imports whose path was tried and answered nothing.
   *
   * Passed in rather than derived: an absent module in the graph means "not
   * there" to one caller and "not indexed yet" to another, and the editor must
   * not draw an error over a neighbour the workspace is still loading.
   */
  unreadable?: readonly UnreadableImport[];
  /** Files that import each other, which is refused rather than half run. */
  cycles?: readonly ImportCycle[];
}): Problem[] {
  const problems: Problem[] = [];
  for (const decl of args.document.imports) {
    if (!isValueImport(decl)) continue;
    const target = args.graph.resolve(args.uri, decl.path);
    const module = args.graph.modules.get(target);
    // A path that reads nothing is already reported by whoever tried to read it.
    if (module) problems.push(...missing({ decl, module, uri: args.uri, path: decl.path }));
    problems.push(...noDefault({ decl, uri: args.uri, npm: args.graph.npm }));
  }
  return [
    ...problems,
    ...fromPackages(args),
    ...checkPackageImport({ ...args, npm: args.graph.npm }),
    ...wentNowhere(args),
    ...wentInCircles(args),
  ];
}

/**
 * A name asked of a package that does not publish it.
 *
 * The everyday one is a verb: `import { get } from "venn/http"` reads as though
 * a verb were a value, and it is not. The note says what to write instead, since
 * the answer is one line away and nobody should have to guess it.
 */
function fromPackages(args: { document: Document; uri: string; registry: Registry }): Problem[] {
  return readImports(args.document, args.registry).unknown.map((one) =>
    buildProblem({
      spec: CODES.VN2009_NOT_EXPORTED,
      // The import that asked, not the file that holds it: in a terminal the
      // whole document reads as 1:1 and nobody notices, and in an editor it is
      // every line underlined.
      span: nodeSpan(one.decl, args.uri),
      title: `"${one.pkg}" does not publish ${one.name}.`,
      ...(one.note ? { note: one.note } : {}),
    }),
  );
}

function missing(args: {
  decl: ValueImport;
  module: Document;
  uri: string;
  path: string;
}): Problem[] {
  const published = exported(args.module);
  return args.decl.names
    .filter((one) => !published.has(one.name))
    .map((one) =>
      buildProblem({
        spec: CODES.VN2009_NOT_EXPORTED,
        span: nodeSpan(args.decl, args.uri),
        title: `"${args.path}" does not publish ${one.name}.`,
        note: hint(one.name, args.module),
      }),
    );
}

/**
 * Why it is not there: written but kept private, or not written at all. The two
 * are different mistakes with different fixes, and a reader told only "not
 * published" goes looking for a typo they did not make.
 */
function hint(name: string, module: Document): string {
  const declared = module.decls.some(
    (decl) => publishable(decl) && (decl as { name?: string }).name === name,
  );
  return declared
    ? `It is declared there, but not marked \`pub\`.`
    : `Nothing of that name is declared there.`;
}

/**
 * What a file offers: everything it marked `pub`, and everything it handed on
 * with `pub import`.
 */
function exported(document: Document): Set<string> {
  return publishedNames(document);
}

/** The declarations `pub` means something on. */
function publishable(decl: unknown): decl is { name: string; export?: boolean } {
  return (
    isFnDecl(decl) ||
    isFragmentDecl(decl) ||
    isDecoDecl(decl) ||
    isTypeDecl(decl) ||
    isLetStmt(decl)
  );
}

/**
 * `import cart from "./cart.vn"`, which binds nothing.
 *
 * The spelling is not dead: a package has a default export and `takePackage`
 * binds it. A `.vn` module is the opposite case, publishing by name with `pub`
 * and having no default at all, so the field is never read and the name is left
 * holding nothing.
 *
 * One spelling, two meanings, and the meaningless one used to fail the way
 * everything else did before this milestone: silently, three lines away.
 */
function noDefault(args: {
  decl: ValueImport;
  uri: string;
  npm?: ReadonlyMap<string, Record<string, unknown>>;
}): Problem[] {
  const name = args.decl.default;
  if (!name) return [];
  const spec = args.decl.path;
  if (!isPackageSpecifier(spec)) return [refuseDefault({ ...args, name, said: A_MODULE })];
  // Nothing loaded means no packages at all, which is every run in a Worker and
  // is not this import's fault.
  const found = args.npm?.get(spec);
  if (!found || "default" in found) return [];
  return [refuseDefault({ ...args, name, said: `"${spec}" publishes no default.` })];
}

const A_MODULE = "A `.vn` module publishes by name, so it has no default.";

function refuseDefault(args: {
  decl: ValueImport;
  uri: string;
  name: string;
  said: string;
}): Problem {
  return {
    ...buildProblem({
      spec: CODES.VN2009_NOT_EXPORTED,
      span: nodeSpan(args.decl, args.uri),
      title: args.said,
    }),
    help: `Write \`import { ${args.name} } from "${args.decl.path}"\`, or \`import * as ${args.name}\` for the whole of it.`,
  };
}

/**
 * A path that led nowhere, said at the import that wrote it.
 *
 * Until this, the module simply was not there: the namespace read as an empty
 * one, every name off it was `null`, and the failure surfaced at whatever used
 * it. The specifier and the resolved path are both shown, because the gap
 * between what was written and where it led is the mistake.
 */
function wentNowhere(args: {
  document: Document;
  uri: string;
  unreadable?: readonly UnreadableImport[];
}): Problem[] {
  const here = (args.unreadable ?? []).filter((one) => one.from === args.uri);
  return here.flatMap((one) => at(one, args.document, args.uri));
}

function at(one: UnreadableImport, document: Document, uri: string): Problem[] {
  const decl = document.imports.find((node) => isValueImport(node) && node.path === one.spec);
  if (!decl) return [];
  return [
    {
      ...buildProblem({
        spec: CODES.VN2019_UNREADABLE_IMPORT,
        span: nodeSpan(decl, uri),
        title: `Nothing to import from "${one.spec}".`,
      }),
      help: `Nothing was read at ${one.tried}.`,
    },
  ];
}

/**
 * Files that import each other, refused rather than half run.
 *
 * A `const` at the top of a file is evaluated when the file is, and a `pub fn`
 * closes over the file it was written in. There is no hoisting to hide behind:
 * one side of a cycle reads what the other has not filled yet, and which side
 * depends on which file the run happened to enter first. Go refuses these for
 * the same reason, and the usual fix, moving what both need into a third file,
 * is the design that was wanted anyway.
 *
 * Said at the import that closes the loop, because that is the one that can be
 * moved, with the way round shown beneath it.
 */
function wentInCircles(args: { cycles?: readonly ImportCycle[] }): Problem[] {
  return (args.cycles ?? []).map((cycle) => ({
    ...buildProblem({
      spec: CODES.VN2021_IMPORT_CYCLE,
      span: whole(cycle.closedBy),
      title: `Importing "${cycle.spec}" here closes a circle.`,
      related: theWayRound(cycle),
    }),
    help: advice(cycle),
  }));
}

/** What to do about it, counting the files rather than assuming two. */
function advice(cycle: ImportCycle): string {
  const many = cycle.path.length > 3 ? "these files" : "both files";
  return `Move what ${many} need into another one, and import that from each.`;
}

/** Each file on the way round, and the one it reaches for. */
function theWayRound(cycle: ImportCycle): RelatedInfo[] {
  return cycle.path.slice(0, -1).map((uri, at) => ({
    span: whole(uri),
    label: `imports ${named(cycle.path[at + 1] as string)}`,
  }));
}

/** The file, since a cycle belongs to files rather than to a line in one. */
function whole(uri: string) {
  return { uri, offset: 0, length: 0, line: 1, column: 1 };
}

/** Its last part: the span beside it already carries where it is. */
function named(uri: string): string {
  return uri.split(SEPARATOR).pop() ?? uri;
}

const SEPARATOR = /[/\\]/;
